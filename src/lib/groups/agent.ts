/**
 * Group-chat @Prava — sits in the party like Meta AI.
 * Only speaks when tagged (or booking/SPOC system prompts).
 * Uses OpenAI credits when available; tools hit Duffel / weather / maps / etc.
 *
 * Safety: any external, financial, or legally meaningful action (payments,
 * reservations, purchases, outbound calls, calendar writes) goes through an
 * ActionApproval — the agent posts an approval_request and waits for a human.
 */

import { executeAgentTool } from "@/lib/agent-tools/registry";
import { createPravaSession } from "@/lib/integrations/prava";
import { completeJson, completeText } from "@/lib/integrations/llm";
import { getPassportRef } from "@/lib/vault/traveler-store";
import { createApproval } from "./approvals";
import { mentionsAidhd, stripMentions } from "./mentions";
import { createPoll, listPolls } from "./polls";
import {
  appendMessage,
  createBookingDraft,
  listMembers,
  listMessages,
  setSpoc,
  updateBookingDraft,
} from "./store";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
  type BookingCategory,
  type GroupMessage,
  type GroupParty,
  type TravelerSlot,
} from "./types";

const SYSTEM = `You are Prava sitting inside a group chat (like Meta AI in WhatsApp).
You help friends plan, book, and buy anything reservable — flights, hotels,
restaurants, concerts, sports, movies, classes, appointments, experiences,
products. Be sharp, warm, decisive.

Rules:
- The RECENT CHAT below is the source of truth. Read it before answering and reuse
  what the group already settled — headcount, dates, budget, city, who is doing what,
  specific items people named. Never ask for something the chat already answered.
- If they already said "10 people", "10 diet cokes", "August 12" — those are facts.
  Build on them; don't restate the question back at them.
- ALWAYS answer the tagged question. Planning, lists, recommendations, opinions and
  recaps are real answers — you are not only a booking bot. Only fall back to
  "what would you like?" if the chat genuinely contains nothing to work with.
- Never invent live prices; call tools (flights, hotels, tickets, dining, weather, payments).
- NEVER ask for passport numbers or card PANs in chat. Passports are ONLY for flight booking
  via private passport links / PassportGate (Remember encrypted vs Use once) — never at login.
- Restaurants/tickets: ask for a SPOC volunteer (name on the reservation).
- Flights: search with party size → one order N vault passports → private collect links for anyone
  missing a passport → review → Prava → book. Chat only shows ✓ ready / still waiting.
- APPROVAL GATE: you never pay, book, reserve, purchase, cancel, call a business,
  or touch someone's calendar without explicit human approval. Propose it —
  the app posts an Approve/Decline card and waits.
- You can also: answer questions, build lists (shopping, packing, to-do) from what the
  group said, create polls, summarize the conversation, suggest plans, coordinate
  shared purchases and split costs, place research calls to businesses (approval
  first), add confirmed plans to Google Calendar (approval first).
- Prefer actionable next steps ("want me to search flights ORD→JFK Sat?").
- Keep replies under ~130 words unless listing 2–3 concrete options.
- hi/thanks → brief, no tools.`;

/** Dates in chat are bare ("August 12") — the model needs an anchor year. */
function todayLine(): string {
  const now = new Date();
  return `TODAY: ${now.toISOString().slice(0, 10)} (${now.toLocaleDateString("en-US", { weekday: "long" })})`;
}

/**
 * The model sees only this string, so it has to carry what the raw row list
 * drops: which day each thing was said on (bare "August 12" is meaningless
 * without it), who is a human vs. Prava's own earlier replies, and the roster
 * churn filtered out so real conversation isn't buried under "X joined".
 */
function buildTranscript(messages: GroupMessage[]): string {
  const lines: string[] = [];
  let day = "";

  for (const m of messages) {
    const body = (m.body || "").trim();
    if (!body) continue;
    // "Kevin joined the party" — the MEMBERS line already covers the roster.
    if (m.kind === "system") continue;

    const stamp = m.created_at.slice(0, 10);
    if (stamp !== day) {
      day = stamp;
      lines.push(`--- ${stamp} ---`);
    }

    const who = m.sender_id === AIDHD_BOT_ID ? AIDHD_BOT_NAME : m.sender_name;
    // Long agent output (passport links, review URLs) crowds out the humans.
    const text = body.length > 320 ? `${body.slice(0, 320)}…` : body;
    lines.push(`${who}: ${text}`);
  }

  return lines.join("\n");
}

/** How polls actually landed — a decision the group made, not just a message. */
async function pollDigest(groupId: string): Promise<string> {
  const polls = await listPolls(groupId).catch(() => []);
  if (!polls.length) return "";

  const lines = polls.slice(0, 3).map((p) => {
    const tally = p.options.map((opt, i) => {
      const voters = (p.votes || []).filter((v) => v.option_index === i);
      const names = voters.map((v) => v.user_name).filter(Boolean).join(", ");
      return `${opt}: ${voters.length}${names ? ` (${names})` : ""}`;
    });
    return `- "${p.question}" [${p.status}] → ${tally.join(" · ")}`;
  });

  return `\nPOLLS:\n${lines.join("\n")}`;
}

type ToolPlan = {
  reply?: string;
  make_list?: { title: string; items: string[] } | null;
  tools?: Array<{ name: string; params: Record<string, unknown> }>;
  ask_spoc?: boolean;
  start_booking?: {
    category: BookingCategory;
    summary: string;
    amount?: number;
    merchant?: string;
  };
  set_spoc_name?: string;
  create_poll?: { question: string; options: string[] } | null;
  summarize?: boolean;
  call_business?: {
    venue_name: string;
    venue_phone?: string;
    venue_type?: string;
    question: string;
  } | null;
  add_to_calendar?: {
    title: string;
    start?: string;
    end?: string;
    location?: string;
    description?: string;
    confirmation_number?: string;
  } | null;
};

/**
 * Models fence JSON even when told not to (Gemini does it routinely), and an
 * unparsed fence used to be posted into the group verbatim as the reply.
 */
function parsePlan(raw: string): ToolPlan | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const candidates = [stripped];
  // Some models prepend a sentence before the object.
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first > 0 && last > first) candidates.push(stripped.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as ToolPlan;
      }
    } catch {
      // try next shape
    }
  }
  return null;
}

const LIST_INTENT =
  /\b(?:make|create|build|write|generate|put together|give me|send)\b[^?]*\blists?\b|\b(?:shopping|packing|grocery|to-?do|todo)\s+list\b|\bwhat\s+(?:do|should|are)\s+we\s+(?:need|get|buy|bring|getting)\b|\bwhat\s+else\s+do\s+we\s+need\b/i;

/**
 * "Here's the list:" with nothing after it. Models answer a list request with
 * the lead-in and drop the items, because `reply` is the easiest field in a
 * ten-field schema to fill.
 */
function isDanglingLeadIn(reply?: string): boolean {
  const t = (reply || "").trim();
  if (!t) return false;
  if (t.length > 200) return false;
  return /:$/.test(t) || /\b(?:here'?s|here is|below is)\b[^.!?]*\blist\b/i.test(t);
}

/**
 * Focused second pass for list asks. A two-field schema gives the model nowhere
 * to hide, where the full plan schema lets it answer with a lead-in and no items.
 */
async function generateList(input: {
  context: string;
  question: string;
}): Promise<{ title: string; items: string[] } | null> {
  const out = await completeJson({
    system: `${SYSTEM}

You are producing ONE list, from what the group already said. Include the exact
quantities and items they named, then add what the plan obviously still needs.
Never return an empty items array — if the chat is thin, infer sensible items
for the occasion. Return JSON only: {"title":"short title","items":["item 1","item 2"]}`,
    user: `${input.context}\n\nBuild the list they asked for.`,
  });
  if (!out?.text) return null;

  const parsed = parsePlan(out.text) as
    | { title?: string; items?: unknown[] }
    | null;
  const items = Array.isArray(parsed?.items)
    ? parsed.items
        .map((i) =>
          typeof i === "string"
            ? i.trim()
            : String((i as { name?: string })?.name ?? "").trim(),
        )
        .filter(Boolean)
    : [];
  if (!items.length) return null;

  return { title: parsed?.title?.trim() || "List", items };
}

/** True when the plan came back with nothing actionable in it. */
function planIsEmpty(plan: ToolPlan): boolean {
  return (
    !plan.reply?.trim() &&
    !plan.tools?.length &&
    !plan.make_list?.items?.length &&
    !plan.start_booking &&
    !plan.create_poll &&
    !plan.summarize &&
    !plan.call_business &&
    !plan.add_to_calendar &&
    !plan.ask_spoc
  );
}

function heuristicTools(question: string, group: GroupParty) {
  const lower = question.toLowerCase();
  const city =
    group.place && group.place !== "TBD"
      ? group.place
      : /chicago/i.test(lower)
        ? "Chicago"
        : /miami/i.test(lower)
          ? "Miami"
          : /bali/i.test(lower)
            ? "Bali"
            : "New York";
  const date =
    group.proposed_dates[0] ||
    new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

  if (/weather|forecast|rain|hot out/i.test(lower)) {
    return [{ name: "get_weather", params: { city, date } }];
  }
  if (/flight|fly|airline/i.test(lower)) {
    return [
      {
        name: "search_flights",
        params: {
          origin: "Chicago",
          destination: city,
          depart_date: date,
        },
      },
    ];
  }
  if (/hotel|stay|airbnb|villa/i.test(lower)) {
    return [
      {
        name: "search_hotels",
        params: { city, check_in: date, check_out: date },
      },
    ];
  }
  if (/dinner|restaurant|eat|food|dining|brunch/i.test(lower)) {
    return [{ name: "search_dining", params: { city } }];
  }
  if (/ticket|concert|show|comedy/i.test(lower)) {
    return [{ name: "search_tickets", params: { keyword: "concert", city } }];
  }
  return [];
}

/** Everything the model needs to know about this group, in prompt order. */
function contextBlock(input: {
  group: GroupParty;
  membersLine: string;
  transcript: string;
  polls: string;
  question: string;
}): string {
  return `${todayLine()}
GROUP: ${input.group.title} (${input.group.mode}) @ ${input.group.place}
DATES: ${input.group.proposed_dates.join(", ") || "TBD"}
SPOC: ${input.group.spoc_user_id || "none"}
MEMBERS: ${input.membersLine}${input.polls}

RECENT CHAT (oldest first — this is what the group actually said):
${input.transcript || "(no messages yet)"}

TAGGED QUESTION:
${input.question}`;
}

async function planReply(input: {
  group: GroupParty;
  question: string;
  transcript: string;
  membersLine: string;
  polls: string;
}): Promise<ToolPlan> {
  const context = contextBlock({
    group: input.group,
    membersLine: input.membersLine,
    transcript: input.transcript,
    polls: input.polls,
    question: input.question,
  });

  const planned = await completeJson({
    system: `${SYSTEM}

Return JSON only. "reply" is REQUIRED whenever you are not starting a booking,
poll, list, call or calendar action — never return an object with every field
null. Answer from RECENT CHAT.
{
  "reply": "your answer to the group, grounded in what they already said",
  "make_list": null | {"title":"Adi house party — shopping list","items":["10 Diet Coke cans","2 party bags of Doritos"]},
  "tools": [{"name":"get_weather|search_flights|search_hotels|search_tickets|search_dining|search_clubs|search_movies|search_products|create_payment","params":{}}],
  "ask_spoc": false,
  "start_booking": null | {"category":"flight|hotel|ticket|dining|trip|event|movie|class|appointment|experience|product|other","summary":"...","amount":0,"merchant":"..."},
  "set_spoc_name": null | "exact display name from members list if they volunteered",
  "create_poll": null | {"question":"...","options":["...","..."]},
  "summarize": false,
  "call_business": null | {"venue_name":"...","venue_phone":"+1...","venue_type":"restaurant|hotel|airline|event_venue|ticket_provider|store|customer_support|merchant|other","question":"what to ask"},
  "add_to_calendar": null | {"title":"...","start":"ISO or YYYY-MM-DD","end":"...","location":"...","description":"...","confirmation_number":"..."}
}`,
    user: context,
  });

  if (planned?.text) {
    const plan = parsePlan(planned.text);
    if (plan && !planIsEmpty(plan)) return plan;

    // JSON mode failed us (unparseable, or every field null). Rather than post a
    // canned deflection, ask again in plain prose with the same context — the
    // group asked a real question and an answer exists in the chat.
    console.warn(
      "[groups/agent] empty plan from",
      planned.provider,
      "— retrying as prose",
    );
    const prose = await completeText({ system: SYSTEM, user: context });
    if (prose?.text?.trim()) return { reply: prose.text.trim() };
    if (plan) return plan;
  }

  const tools = heuristicTools(input.question, input.group);
  if (tools.length) return { tools };

  console.warn("[groups/agent] no LLM available — check OPENAI_API_KEY/GEMINI_API_KEY");
  return {
    reply:
      "I'm here — ask me about weather, flights, hotels, tickets, or restaurants. Say @AiDHD book dinner if you want me to lock a table (I'll ask for a SPOC).",
  };
}

export async function maybeHandleAgentMention(input: {
  group: GroupParty;
  senderId: string;
  senderName: string;
  body: string;
  origin: string;
}): Promise<{ handled: boolean; agentMessageId?: string }> {
  if (!mentionsAidhd(input.body)) {
    return { handled: false };
  }

  const question = stripMentions(input.body) || input.body;
  const members = await listMembers(input.group.id);
  const humans = members.filter((m) => m.role !== "bot");
  const [messages, polls] = await Promise.all([
    listMessages(input.group.id, 60),
    pollDigest(input.group.id),
  ]);
  const transcript = buildTranscript(messages.slice(-40));
  const membersLine = humans
    .map((m) => `${m.display_name} (${m.role})`)
    .join(", ");

  // Buy a linked product. Handled before the LLM plan because a product URL is
  // unambiguous — no reason to let the model reinterpret it — and because the
  // money path must always land on an approval card, never on a tool call.
  const { looksLikePurchaseRequest, looksLikePaidConfirmation, getPendingPurchase } =
    await import("@/lib/commerce/chat-purchase");

  if (looksLikePaidConfirmation(question) && getPendingPurchase(input.group.id)) {
    const { finishPurchase } = await import("@/lib/commerce/chat-purchase");
    const done = await finishPurchase(input.group.id);
    const msg = await appendMessage({
      groupId: input.group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: done.ok ? `✅ ${done.summary}` : done.summary,
      kind: done.ok ? "tool_result" : "agent",
    });
    return { handled: true, agentMessageId: msg?.id };
  }

  if (looksLikePurchaseRequest(input.body)) {
    const { resolveBuyable } = await import("@/lib/commerce/chat-purchase");
    const buyable = await resolveBuyable(input.body);
    if (!buyable.ok) {
      const msg = await appendMessage({
        groupId: input.group.id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: buyable.reason,
        kind: "agent",
      });
      return { handled: true, agentMessageId: msg?.id };
    }

    const offer = buyable.offer;
    const buyer = humans.find((h) => h.user_id === input.senderId);
    await createApproval({
      groupId: input.group.id,
      kind: "purchase",
      summary: `Buy ${offer.title} — $${offer.price.toFixed(2)} ${offer.currency}`,
      amountUsd: offer.price,
      payload: {
        action: "buy_product",
        variant_id: offer.variant_id,
        title: offer.title,
        amount: offer.price,
        merchant: process.env.SHOPIFY_STORE_DOMAIN || "the store",
        buyer_user_id: input.senderId,
        buyer_email: buyer?.email || "shopper@aidhd.app",
        buyer_name: input.senderName,
        product_url: offer.url,
        source: buyable.source,
      },
    });
    return { handled: true };
  }

  // Volunteer as SPOC via natural language
  if (
    /\b(i'?ll be|i can be|i'?m|make me|volunteer(?:ing)? as)\s+(the\s+)?spoc\b/i.test(
      question,
    ) ||
    /\bi'?ll (put my name|take the reservation)\b/i.test(question)
  ) {
    await setSpoc(input.group.id, input.senderId);
    return { handled: true };
  }

  const plan = await planReply({
    group: input.group,
    question,
    transcript,
    membersLine,
    polls,
  });

  // Natural-language book intents even if the LLM omitted start_booking
  if (
    !plan.start_booking &&
    /\bbook\b|\breserve\b|\block (?:a |the )?(?:table|tickets?|flights?)\b/i.test(
      question,
    )
  ) {
    const category: BookingCategory = /flight|fly/i.test(question)
      ? "flight"
      : /hotel|stay/i.test(question)
        ? "hotel"
        : /ticket|concert|show/i.test(question)
          ? "ticket"
          : /dinner|restaurant|table|dining/i.test(question)
            ? "dining"
            : input.group.mode === "trip"
              ? "trip"
              : "dining";
    plan.start_booking = {
      category,
      summary: `${category} for ${input.group.title} (${humans.length} people)`,
      amount: category === "dining" ? 40 * humans.length : 120 * humans.length,
      merchant: input.group.place || input.group.title,
    };
    if (
      (category === "dining" || category === "ticket") &&
      !input.group.spoc_user_id
    ) {
      plan.ask_spoc = true;
    }
  }

  if (plan.set_spoc_name) {
    const match = humans.find(
      (m) =>
        m.display_name.toLowerCase() === plan.set_spoc_name!.toLowerCase(),
    );
    if (match) await setSpoc(input.group.id, match.user_id);
  }

  // Heuristic fallbacks when the LLM is unavailable / omitted an intent.
  if (
    !plan.create_poll &&
    /\b(make|create|start|run)\b.*\bpoll\b|\bpoll\b.*\b(for|about|on)\b/i.test(
      question,
    )
  ) {
    const optMatch = question.match(/poll(?:\s+(?:for|about|on))?:?\s*(.+)$/i);
    const rawOptions = (optMatch?.[1] || "")
      .split(/\s+(?:vs\.?|or)\s+|,/i)
      .map((o) => o.trim())
      .filter(Boolean);
    plan.create_poll = {
      question: optMatch?.[1]?.trim() || "What should we do?",
      options: rawOptions.length >= 2 ? rawOptions : ["Yes", "No"],
    };
  }
  if (!plan.summarize && /\bsummar(y|ize|ise)\b|\bcatch me up\b|\btl;?dr\b/i.test(question)) {
    plan.summarize = true;
  }

  // A list was asked for but none came back (or only a "here's the list:"
  // lead-in did) — go get the items with a schema that has no escape hatch.
  if (
    !plan.make_list?.items?.length &&
    (LIST_INTENT.test(question) || isDanglingLeadIn(plan.reply))
  ) {
    const built = await generateList({
      context: contextBlock({
        group: input.group,
        membersLine,
        transcript,
        polls,
        question,
      }),
      question,
    });
    if (built) {
      plan.make_list = built;
      // The lead-in is now redundant with the list right under it.
      if (isDanglingLeadIn(plan.reply)) plan.reply = "";
    }
  }

  // List → post it as a checklist the group can read at a glance. Internal, no
  // approval: nothing is bought until someone tags @Prava to actually order.
  if (plan.make_list?.items?.length) {
    const items = plan.make_list.items
      .map((i) => String(i).trim())
      .filter(Boolean)
      .slice(0, 40);
    const title = plan.make_list.title?.trim() || `${input.group.title} — list`;
    const msg = await appendMessage({
      groupId: input.group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      // Models write "here's the list:" as a lead-in, so it goes above.
      body: `${plan.reply?.trim() ? `${plan.reply.trim()}\n\n` : ""}📝 ${title}\n${items
        .map((i) => `• ${i}`)
        .join("\n")}`,
      kind: "agent",
      meta: { list: { title, items } },
    });
    return { handled: true, agentMessageId: msg?.id };
  }

  // Poll → post it and let the group vote (internal action, no approval needed).
  if (plan.create_poll?.question && plan.create_poll.options?.length >= 2) {
    const poll = await createPoll({
      groupId: input.group.id,
      question: plan.create_poll.question,
      options: plan.create_poll.options,
      createdBy: AIDHD_BOT_ID,
      createdByName: AIDHD_BOT_NAME,
    });
    return { handled: true, agentMessageId: poll.message_id || undefined };
  }

  // Summarize the conversation on request.
  if (plan.summarize) {
    const summary = await completeText({
      system: SYSTEM,
      user: `Summarize this group conversation in under 110 words for someone catching up. Bullet the decisions, open questions, and who's doing what.\n\n${transcript}`,
    });
    const msg = await appendMessage({
      groupId: input.group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body:
        summary?.text?.trim() ||
        "Not much to summarize yet — the chat is just getting started.",
      kind: "agent",
      meta: { summary: true },
    });
    return { handled: true, agentMessageId: msg?.id };
  }

  // Outbound call to a business → requires explicit approval first.
  if (plan.call_business?.venue_name) {
    if (!plan.call_business.venue_phone) {
      const msg = await appendMessage({
        groupId: input.group.id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: `I can call ${plan.call_business.venue_name} to ask "${plan.call_business.question}" — what's their phone number? (Or say @Prava call ${plan.call_business.venue_name} at +1…)`,
        kind: "agent",
      });
      return { handled: true, agentMessageId: msg?.id };
    }
    await createApproval({
      groupId: input.group.id,
      kind: "outbound_call",
      summary: `Call ${plan.call_business.venue_name} and ask: ${plan.call_business.question}`,
      payload: {
        action: "call",
        venue_name: plan.call_business.venue_name,
        venue_phone: plan.call_business.venue_phone,
        venue_type: plan.call_business.venue_type || "other",
        question: plan.call_business.question,
      },
    });
    return { handled: true };
  }

  // Calendar write → requires explicit approval from the requester.
  if (plan.add_to_calendar?.title) {
    await createApproval({
      groupId: input.group.id,
      kind: "calendar_create",
      summary: `Add "${plan.add_to_calendar.title}" to ${input.senderName}'s Google Calendar${plan.add_to_calendar.start ? ` (${plan.add_to_calendar.start})` : ""}`,
      payload: {
        action: "calendar_create",
        user_id: input.senderId,
        event: {
          title: plan.add_to_calendar.title,
          start: plan.add_to_calendar.start,
          end: plan.add_to_calendar.end,
          location: plan.add_to_calendar.location,
          description: plan.add_to_calendar.description,
          confirmation_number: plan.add_to_calendar.confirmation_number,
          attendees: humans.map((h) => h.email).filter(Boolean),
        },
      },
    });
    return { handled: true };
  }

  const toolBits: string[] = [];
  let lastFlightOfferId: string | undefined;
  for (const t of plan.tools || []) {
    const params = { ...(t.params || {}) };
    if (t.name === "search_flights" && params.passengers == null) {
      params.passengers = humans.length;
    }
    const result = await executeAgentTool(t.name, params);
    toolBits.push(result.summary);
    const offers = (result.data as { offers?: Array<{ id?: string }> } | undefined)
      ?.offers;
    if (offers?.[0]?.id) lastFlightOfferId = String(offers[0].id);
  }

  if (plan.ask_spoc && !input.group.spoc_user_id && !plan.start_booking) {
    const msg = await appendMessage({
      groupId: input.group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: `Who wants to be SPOC for the booking? Reply @AiDHD I'll be SPOC — I'll put that name on the reservation and confirm headcount (${humans.length} people).`,
      kind: "spoc_ask",
    });
    return { handled: true, agentMessageId: msg?.id };
  }

  if (plan.start_booking) {
    const category = plan.start_booking.category;

    // Dining with a SPOC set: propose the reservation — a human must approve
    // before we commit anything with the restaurant.
    if (category === "dining" && input.group.spoc_user_id) {
      const spoc =
        humans.find((h) => h.user_id === input.group.spoc_user_id) ||
        humans[0];
      const restaurant =
        plan.start_booking.merchant || input.group.place || input.group.title;
      await createApproval({
        groupId: input.group.id,
        kind: "reservation",
        summary: `Reserve ${restaurant} for ${humans.length} under ${spoc?.display_name || "Guest"}${input.group.proposed_dates[0] ? ` on ${input.group.proposed_dates[0]}` : ""}`,
        payload: {
          action: "tool",
          tool: "confirm_dining_reservation",
          params: {
            restaurant,
            spoc_name: spoc?.display_name || "Guest",
            party_size: humans.length,
            time: input.group.proposed_dates[0],
          },
        },
      });
      return { handled: true };
    }

    if (
      (category === "dining" || category === "ticket") &&
      !input.group.spoc_user_id
    ) {
      const msg = await appendMessage({
        groupId: input.group.id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: `Who wants to be SPOC? Reply @AiDHD I'll be SPOC — then I'll reserve under that name for ${humans.length} people.`,
        kind: "spoc_ask",
      });
      return { handled: true, agentMessageId: msg?.id };
    }

    const needsPassport = category === "flight" || category === "trip";
    const travelers: TravelerSlot[] = [];
    for (const h of humans) {
      const ref = await getPassportRef(h.user_id);
      travelers.push({
        user_id: h.user_id,
        display_name: h.display_name,
        passport_present: Boolean(ref?.present),
        needs_passport: needsPassport,
      });
    }

    const amount = plan.start_booking.amount ?? 0;
    const draft = await createBookingDraft({
      groupId: input.group.id,
      category,
      createdBy: input.senderId,
      partySize: humans.length,
      travelers,
      offer: {
        summary: plan.start_booking.summary,
        amount,
        merchant: plan.start_booking.merchant || input.group.title,
        spoc_user_id: input.group.spoc_user_id,
        tool_notes: toolBits,
        booking_mode: needsPassport ? "one_order_n_passports" : "standard",
        ...(lastFlightOfferId ? { offer_id: lastFlightOfferId } : {}),
      },
    });

    const missing = draft.travelers.filter(
      (t) => t.needs_passport && !t.passport_present,
    );
    const reviewUrl = `${input.origin}/groups/${input.group.id}/review/${draft.review_token}`;

    // Private passport links — numbers never go in chat; only status + links
    if (missing.length) {
      const linkLines = missing.map((m) => {
        const url = `${input.origin}/groups/${input.group.id}/passport/${m.collect_token}`;
        return `• ${m.display_name}: ${url}`;
      });
      await appendMessage({
        groupId: input.group.id,
        senderId: AIDHD_BOT_ID,
        senderName: AIDHD_BOT_NAME,
        body: `One order for ${humans.length} — need passports privately (not in this chat).\nEach person without a saved passport taps their own link:\n${linkLines.join("\n")}\nI'll only post ✓ ready / still waiting — never passport numbers.`,
        kind: "booking_prompt",
        meta: {
          draft_id: draft.id,
          passport_collect: true,
          missing_user_ids: missing.map((m) => m.user_id),
        },
      });
    }

    // Prava only after passports ready (or no passport needed)
    if (amount > 0 && missing.length === 0) {
      const payer =
        humans.find((h) => h.user_id === input.group.spoc_user_id) ||
        humans.find((h) => h.user_id === input.group.organizer_id) ||
        humans[0];
      const session = await createPravaSession({
        user_id: payer?.user_id || input.senderId,
        user_email: payer?.email || "spoc@aidhd.app",
        merchant: plan.start_booking.merchant || input.group.title,
        amount,
        currency: "USD",
        category: category === "trip" ? "flight" : category,
      });
      draft.prava_session_id = session.session_id;
      draft.status = "awaiting_payment";
      await updateBookingDraft(draft);
    }

    let body = `Booking draft ready — ${plan.start_booking.summary}.\nOne order · ${humans.length} travelers.\nReview & approve: ${reviewUrl}`;
    if (missing.length) {
      body += `\nWaiting on private passport links above for: ${missing.map((m) => m.display_name).join(", ")}.`;
    } else if (needsPassport) {
      body += `\nAll passports on file — host can approve & pay. Tickets issue on vault numbers (never shared here).`;
    }

    const msg = await appendMessage({
      groupId: input.group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body,
      kind: "review_link",
      meta: { review_token: draft.review_token, draft_id: draft.id },
    });
    return { handled: true, agentMessageId: msg?.id };
  }

  let reply = plan.reply?.trim() || "";
  if (toolBits.length) {
    const synthesis = await completeText({
      system: SYSTEM,
      user: `${todayLine()}\nGroup context:\n${transcript}\n\nQuestion: ${question}\n\nTool results:\n${toolBits.join("\n")}\n\nWrite the chat reply.`,
    });
    reply = synthesis?.text?.trim() || toolBits.join(" ");
  }

  // Last resort: answer the question from the chat rather than deflecting with a
  // menu of features. The canned line is what made @Prava look like it had not
  // read the conversation. A bare "here's the list:" is just as useless, so it
  // gets the same treatment.
  if (!reply || (isDanglingLeadIn(reply) && !toolBits.length)) {
    const grounded = await completeText({
      system: SYSTEM,
      user: contextBlock({
        group: input.group,
        membersLine,
        transcript,
        polls,
        question,
      }),
    });
    reply = grounded?.text?.trim() || "";
  }

  if (!reply) {
    reply =
      "I couldn't reach my model just now — try me again in a sec, or say @Prava book dinner / book tickets to start a draft.";
  }

  const msg = await appendMessage({
    groupId: input.group.id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: reply,
    kind: toolBits.length ? "tool_result" : "agent",
    meta: { tools: toolBits },
  });

  return { handled: true, agentMessageId: msg?.id };
}
