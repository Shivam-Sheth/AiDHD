import {
  handleCollectorMessage,
  startCollector,
} from "./web-chat";
import { reconcileAndGeneratePackages } from "../agent/reconcile";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "../integrations/whatsapp";
import { searchTickets } from "../integrations/ticketmaster";
import {
  getContactByPhone,
  normalizePhone,
  registerWhatsAppContact,
  seedJordanPhoneIfConfigured,
} from "../integrations/whatsapp-phonebook";
import {
  ensureSeeded,
  getCollector,
  getEvent,
  listResponses,
  setPackages,
  upsertEvent,
} from "../store";

const DEFAULT_EVENT =
  process.env.WHATSAPP_DEFAULT_EVENT_ID || "evt_demo_friday";

function lastAssistantTexts(
  beforeCount: number,
  afterMessages: { role: string; content: string }[],
): string[] {
  return afterMessages
    .slice(beforeCount)
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
}

/** One Graph call beats 2–3 sequential sends. */
async function replyOnce(to: string, parts: string[]) {
  const body = parts.filter(Boolean).join("\n\n").trim();
  if (!body) return;
  await sendWhatsAppMessage({ to, body });
}

function cityFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("brooklyn")) return "Brooklyn";
  if (lower.includes("manhattan") || lower.includes("nyc") || lower.includes("new york"))
    return "New York";
  return "New York";
}

function keywordFromText(text: string): string {
  const lower = text.toLowerCase();
  for (const k of [
    "jazz",
    "comedy",
    "sports",
    "theater",
    "theatre",
    "rap",
    "rock",
    "concert",
  ]) {
    if (lower.includes(k)) return k === "theatre" ? "theater" : k;
  }
  return "concert";
}

export async function formatTicketmasterPreview(input: {
  keyword?: string;
  city?: string;
  max_price?: number;
}): Promise<string> {
  const { offers, source } = await searchTickets({
    keyword: input.keyword || "concert",
    city: input.city || "New York",
    max_price: input.max_price,
  });
  if (!offers.length) {
    return "No Ticketmaster hits — try EVENTS again with different prefs.";
  }
  const lines = offers.slice(0, 3).map((o, i) => {
    const when = o.date.slice(0, 10);
    return `${i + 1}. ${o.event_name} — $${o.price} @ ${o.venue} (${when})`;
  });
  return `Ticketmaster (${source}):\n${lines.join("\n")}`;
}

export async function inviteWhatsAppPhones(input: {
  phones: { phone: string; name?: string }[];
  event_id?: string;
}): Promise<{
  invited: string[];
  event_id: string;
  from_display: string;
  tip: string;
}> {
  ensureSeeded();
  seedJordanPhoneIfConfigured();
  const eventId = input.event_id || DEFAULT_EVENT;
  const event = getEvent(eventId);
  if (!event) throw new Error("Event not found");

  const invited: string[] = [];
  for (const row of input.phones) {
    const contact = registerWhatsAppContact({
      phone: row.phone,
      name: row.name,
    });
    const live = getEvent(eventId)!;
    if (!live.invitee_ids.includes(contact.user_id)) {
      upsertEvent({
        ...live,
        invitee_ids: [...live.invitee_ids, contact.user_id],
      });
    }
    startCollector(eventId, contact.user_id, {
      channel: "whatsapp",
      name: contact.name,
    });
    const title = getEvent(eventId)?.title ?? "Friday night out";
    // Template (reliable) + one short text (not 3 Graph round-trips)
    await sendWhatsAppTemplate({ to: contact.phone });
    await sendWhatsAppMessage({
      to: contact.phone,
      body: `AiDHD — ${title}.\nBudget for the night? (e.g. 120)\nThen dates → vibe → YES for Ticketmaster.`,
    });
    invited.push(contact.phone);
  }
  return {
    invited,
    event_id: eventId,
    from_display: "+1 (555) 158-1137",
    tip: "Look for +1 (555) 158-1137. Reply with a budget number in that chat.",
  };
}

export async function handleWhatsAppInbound(input: {
  from: string;
  text: string;
  profileName?: string;
}): Promise<{ replies: string[]; user_id: string; event_id: string }> {
  ensureSeeded();
  seedJordanPhoneIfConfigured();

  const phone = normalizePhone(input.from);
  const contact =
    getContactByPhone(phone) ??
    registerWhatsAppContact({
      phone,
      name: input.profileName,
    });
  if (input.profileName && contact.name.startsWith("Friend ")) {
    contact.name = input.profileName;
  }

  const eventId = DEFAULT_EVENT;
  const event = getEvent(eventId);
  if (!event) throw new Error("Demo event missing");

  if (!event.invitee_ids.includes(contact.user_id)) {
    upsertEvent({
      ...event,
      invitee_ids: [...event.invitee_ids, contact.user_id],
    });
  }

  const text = input.text.trim();
  const lower = text.toLowerCase();
  const replies: string[] = [];

  if (/^(help|hi|hello|start|plan)\b/i.test(lower)) {
    startCollector(eventId, contact.user_id, {
      channel: "whatsapp",
      name: contact.name,
    });
    replies.push(
      `Hey ${contact.name} — budget for "${getEvent(eventId)?.title}"?\nReply e.g. 120 (or Under $80 / $80–$120 / $120–$200).`,
    );
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  if (/^(events|find|tickets|ticketmaster)\b/i.test(lower)) {
    const session = getCollector(eventId, contact.user_id);
    const prefText =
      session?.draft.preferences?.free_text ||
      session?.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ") ||
      text;
    const msg = await formatTicketmasterPreview({
      keyword: keywordFromText(prefText),
      city: cityFromText(prefText),
      max_price: session?.draft.budget_cap,
    });
    replies.push(msg);
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  if (/^(packages|reconcile)\b/i.test(lower)) {
    const responses = listResponses(eventId);
    if (!responses.length) {
      replies.push("No prefs yet — send a budget number to start.");
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    // Acknowledge fast, then reconcile (can take a few seconds)
    await replyOnce(phone, ["Building packages…"]);
    const fresh = getEvent(eventId)!;
    upsertEvent({ ...fresh, status: "reconciling" });
    const result = await reconcileAndGeneratePackages(fresh, responses);
    setPackages(eventId, result.packages);
    upsertEvent({ ...getEvent(eventId)!, status: "voting" });
    const summary = result.packages
      .map((p) => `• ${p.label} — $${p.total_cost}`)
      .join("\n");
    const msg = `Packages:\n${summary}\n\nVote on localhost:3000 → Prava.`;
    replies.push(msg);
    await replyOnce(phone, [msg]);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  let session = getCollector(eventId, contact.user_id);
  if (!session) {
    session = startCollector(eventId, contact.user_id, {
      channel: "whatsapp",
      name: contact.name,
    });
    const looksLikeBudget = /\$?\d{2,4}|under|budget/i.test(text);
    if (!looksLikeBudget) {
      replies.push(
        `Hey ${contact.name} — budget for the night? (e.g. 120)`,
      );
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
  }

  const before = session.messages.length;
  const result = handleCollectorMessage(eventId, contact.user_id, text);
  const newReplies = lastAssistantTexts(before, result.session.messages);

  // Fast path: send collector reply immediately (no Ticketmaster/Gemini yet)
  if (newReplies.length) {
    replies.push(...newReplies);
    await replyOnce(phone, newReplies);
  }

  // Slow work AFTER the user already got the next question
  if (result.response) {
    const prefText = result.response.preferences.free_text;
    const tm = await formatTicketmasterPreview({
      keyword: keywordFromText(prefText),
      city: cityFromText(prefText),
      max_price: result.response.budget_cap,
    });
    replies.push(tm);
    await replyOnce(phone, [tm]);
  }

  return { replies, user_id: contact.user_id, event_id: eventId };
}
