/**
 * SMS concierge — full Prava agent over Linq texting for *verified* users.
 *
 * Flow per inbound text:
 * 1. Identify the user (verified sms_links row — handled by the webhook).
 * 2. Understand the request with the LLM (context = recent turns).
 * 3. Ask for anything missing.
 * 4. Run searches and text back numbered options.
 * 5. For any external / financial action: file an ActionApproval and ask the
 *    user to reply YES (explicit confirmation) or NO.
 * 6. On YES: execute, text the confirmation / receipt / booking number.
 * 7. Sync the outcome into the user's default group chat when set.
 *
 * Security: never text passport numbers, card PANs, CVVs, or passwords.
 * Payments only ever go out as Prava-hosted checkout links.
 */

import { executeAgentTool } from "../agent-tools/registry";
import { createApproval, decideApproval, getApproval } from "@/lib/groups/approvals";
import { appendMessage } from "@/lib/groups/store";
import { AIDHD_BOT_ID, AIDHD_BOT_NAME, type ApprovalKind } from "@/lib/groups/types";
import { completeJson } from "@/lib/integrations/llm";
import { sendLinqChatMessage } from "@/lib/integrations/linq";
import { saveSmsSession, type SmsLink } from "@/lib/sms/identity";

const SEARCH_TOOLS = new Set([
  "search_flights",
  "search_hotels",
  "search_dining",
  "search_tickets",
  "search_clubs",
  "search_movies",
  "get_weather",
]);

const PROPOSAL_KINDS: Record<string, ApprovalKind> = {
  booking: "booking",
  reservation: "reservation",
  purchase: "purchase",
  payment: "payment",
  calendar: "calendar_create",
  call: "outbound_call",
};

const SYSTEM = `You are Prava, an SMS concierge. The user texts requests like
"book a table for four tomorrow at 8pm", "find flights to New York next
weekend", "reserve tickets for this event", "add this plan to my calendar".

Return STRICT JSON:
{
  "reply": "short SMS-friendly reply (lowercase-casual ok, <300 chars, no markdown)",
  "search": null | {"tool":"search_flights|search_hotels|search_dining|search_tickets|search_clubs|search_movies|get_weather","params":{...}},
  "proposal": null | {
    "kind": "booking|reservation|purchase|payment|calendar",
    "summary": "one-line description of the action",
    "amount_usd": 0,
    "tool": "confirm_dining_reservation|create_payment|null",
    "params": {...},
    "calendar_event": null | {"title":"...","start":"ISO","end":"ISO","location":"..."}
  }
}

Rules:
- If information is missing (date, time, party size, city, budget), ask in "reply" — no search, no proposal.
- Search FIRST when the user wants options; propose only after they picked or the request is fully specified.
- A proposal is NEVER executed directly — the app asks the user to reply YES. Don't say it's done.
- Never ask for or repeat card numbers, CVVs, passwords, or passport numbers over SMS.
- For reservations use tool confirm_dining_reservation with params {restaurant, spoc_name, party_size, time}.
- For purchases/payments use tool create_payment with params {merchant, amount, category} — the user gets a secure hosted checkout link.
- For calendar set kind "calendar" and fill calendar_event.`;

type ConciergePlan = {
  reply?: string;
  search?: { tool: string; params: Record<string, unknown> } | null;
  proposal?: {
    kind: string;
    summary: string;
    amount_usd?: number;
    tool?: string | null;
    params?: Record<string, unknown>;
    calendar_event?: {
      title: string;
      start?: string;
      end?: string;
      location?: string;
    } | null;
  } | null;
};

function humanize(summary: string): string {
  return summary
    .replace(/\s*Cards are on (the user's screen|screen)[^.]*\.?/gi, "")
    .replace(/\s*— summarize briefly\.?/gi, "")
    .replace(/\s*do not read URLs aloud\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function reply(chatId: string, text: string, bag: string[]) {
  bag.push(text);
  const sent = await sendLinqChatMessage({ chat_id: chatId, text });
  if (!sent.ok) console.error("[sms-concierge] send failed", sent.status);
}

async function syncToGroup(link: SmsLink, text: string) {
  if (!link.default_group_id) return;
  try {
    await appendMessage({
      groupId: link.default_group_id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: `📱 ${link.user_name} via SMS — ${text}`,
      kind: "tool_result",
      meta: { via: "sms" },
    });
  } catch {
    // non-fatal
  }
}

export async function handleConciergeSms(input: {
  link: SmsLink;
  chatId: string;
  text: string;
}): Promise<{ replies: string[] }> {
  const { link, chatId } = input;
  const text = input.text.trim();
  const replies: string[] = [];
  const session = link.session || {};
  const history = session.history || [];

  // -------------------------------------------------------------------
  // Pending confirmation? YES executes, NO declines.
  // -------------------------------------------------------------------
  if (session.pending_approval_id) {
    if (/^(yes|y|confirm|approve|do it|book it|yep|yes please)\b/i.test(text)) {
      const approval = await decideApproval({
        approvalId: session.pending_approval_id,
        decision: "approved",
        decidedBy: link.user_id,
        decidedByName: link.user_name,
      });
      session.pending_approval_id = undefined;
      const outcome = approval?.result as
        | { ok?: boolean; summary?: string; data?: Record<string, unknown> }
        | undefined;
      if (approval?.status === "executed") {
        const data = (outcome?.data ?? {}) as Record<string, unknown>;
        const confirmation =
          (data.confirmation_id as string | undefined) ||
          (data.booking_reference as string | undefined);
        const payUrl =
          (data.pay_url as string) ||
          (data.iframe_url as string) ||
          undefined;
        let msg = `done ✅ ${humanize(outcome?.summary || approval.summary)}`;
        if (confirmation) msg += `\nconfirmation: ${confirmation}`;
        if (payUrl) msg += `\nsecure checkout: ${payUrl}`;
        await reply(chatId, msg, replies);
        await syncToGroup(
          link,
          `confirmed: ${approval.summary}${confirmation ? ` (${confirmation})` : ""}`,
        );
      } else {
        await reply(
          chatId,
          `hmm, that didn't go through: ${humanize(outcome?.summary || "unknown error")}. want me to try something else?`,
          replies,
        );
      }
      session.history = [...history, { role: "user" as const, text }].slice(-8);
      await saveSmsSession(link.phone, session);
      return { replies };
    }

    if (/^(no|n|nope|cancel|stop that|decline|nah)\b/i.test(text)) {
      await decideApproval({
        approvalId: session.pending_approval_id,
        decision: "declined",
        decidedBy: link.user_id,
        decidedByName: link.user_name,
      });
      session.pending_approval_id = undefined;
      await reply(chatId, "ok, cancelled. what else can i do?", replies);
      await saveSmsSession(link.phone, session);
      return { replies };
    }

    // Anything else while pending → remind, then fall through to normal flow.
    const pending = await getApproval(session.pending_approval_id);
    if (pending?.status === "pending") {
      await reply(
        chatId,
        `(still waiting on a YES/NO for: ${pending.summary})`,
        replies,
      );
    } else {
      session.pending_approval_id = undefined;
    }
  }

  // -------------------------------------------------------------------
  // Understand the request.
  // -------------------------------------------------------------------
  const transcript = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? link.user_name : "Prava"}: ${h.text}`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const planned = await completeJson({
    system: SYSTEM,
    user: `USER: ${link.user_name} (verified SMS user)
TODAY: ${today}
RECENT CONVERSATION:
${transcript || "(none)"}
${
  session.last_options?.length
    ? `LAST OPTIONS TEXTED (user may reply with a number):\n${JSON.stringify(session.last_options).slice(0, 1500)}`
    : ""
}

NEW TEXT:
${text}`,
  });

  let plan: ConciergePlan = {};
  if (planned?.text) {
    try {
      plan = JSON.parse(planned.text) as ConciergePlan;
    } catch {
      plan = { reply: planned.text.slice(0, 300) };
    }
  } else {
    plan = {
      reply:
        "i can find + book flights, hotels, tables, tickets and more. try: 'book a table for 4 tomorrow 8pm in chicago'",
    };
  }

  // -------------------------------------------------------------------
  // Search → numbered options.
  // -------------------------------------------------------------------
  if (plan.search?.tool && SEARCH_TOOLS.has(plan.search.tool)) {
    if (plan.reply) await reply(chatId, plan.reply, replies);
    const result = await executeAgentTool(
      plan.search.tool,
      plan.search.params || {},
    );
    const offers =
      ((result.data as { offers?: Array<Record<string, unknown>> })?.offers ||
        []) as Array<Record<string, unknown>>;
    if (offers.length) {
      const lines = offers.slice(0, 4).map((o, i) => {
        const name =
          o.name || o.airline || o.event_name || o.title || o.vendor || "option";
        const price =
          o.price_per_person ?? o.price_total ?? o.price ?? o.cover ?? null;
        return `${i + 1}. ${name}${price != null ? ` — ~$${Math.round(Number(price))}` : ""}`;
      });
      await reply(
        chatId,
        `${lines.join("\n")}\n\nreply with a number to book, or tell me more`,
        replies,
      );
      session.last_options = offers.slice(0, 4).map((o, i) => ({
        index: i + 1,
        tool: plan.search!.tool,
        offer: o,
      }));
    } else {
      await reply(chatId, humanize(result.summary), replies);
    }
    session.history = [
      ...history,
      { role: "user" as const, text },
      { role: "assistant" as const, text: humanize(result.summary).slice(0, 200) },
    ].slice(-8);
    await saveSmsSession(link.phone, session);
    return { replies };
  }

  // -------------------------------------------------------------------
  // Proposal → approval + explicit YES confirmation.
  // -------------------------------------------------------------------
  if (plan.proposal?.summary) {
    const p = plan.proposal;
    const kind = PROPOSAL_KINDS[p.kind] || "other";
    const payload: Record<string, unknown> =
      kind === "calendar_create"
        ? {
            action: "calendar_create",
            user_id: link.user_id,
            event: p.calendar_event || { title: p.summary },
          }
        : {
            action: "tool",
            tool: p.tool || "create_payment",
            params: p.params || {},
          };

    const approval = await createApproval({
      userId: link.user_id,
      groupId: link.default_group_id || undefined,
      kind,
      summary: p.summary,
      amountUsd: p.amount_usd || undefined,
      payload,
      announceInGroup: false,
    });
    session.pending_approval_id = approval.id;

    const amountLine =
      p.amount_usd && p.amount_usd > 0 ? ` (total $${p.amount_usd})` : "";
    await reply(
      chatId,
      `${p.summary}${amountLine}\n\nreply YES to confirm or NO to cancel`,
      replies,
    );
    session.history = [
      ...history,
      { role: "user" as const, text },
      { role: "assistant" as const, text: `proposed: ${p.summary}` },
    ].slice(-8);
    await saveSmsSession(link.phone, session);
    return { replies };
  }

  // -------------------------------------------------------------------
  // Plain reply (missing info, chit-chat, help).
  // -------------------------------------------------------------------
  await reply(
    chatId,
    plan.reply ||
      "tell me what you need — a table, flights, hotel, tickets, or add something to your calendar",
    replies,
  );
  session.history = [
    ...history,
    { role: "user" as const, text },
    { role: "assistant" as const, text: (plan.reply || "").slice(0, 200) },
  ].slice(-8);
  await saveSmsSession(link.phone, session);
  return { replies };
}
