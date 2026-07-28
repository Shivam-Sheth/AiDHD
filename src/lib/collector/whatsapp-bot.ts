import {
  handleCollectorMessage,
  startCollector,
} from "./web-chat";
import {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from "../integrations/whatsapp";
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

/**
 * WhatsApp = collector only.
 * After prefs are in, AiDHD's multi-agent subnet (tickets/flights/hotels/voice) takes over on the web/API.
 */
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
    await sendWhatsAppTemplate({ to: contact.phone });
    await sendWhatsAppMessage({
      to: contact.phone,
      body: `AiDHD collector — ${title}.\nI only take budget → dates → vibe.\nAgents handle tickets/flights/hotels/booking.\nBudget? (e.g. 120)`,
    });
    invited.push(contact.phone);
  }
  return {
    invited,
    event_id: eventId,
    from_display: "+1 (555) 158-1137",
    tip: "Collector only. Reply with budget in the 555 chat.",
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
      `Hey ${contact.name} — collector mode for "${getEvent(eventId)?.title}".\nBudget? (e.g. 120)\nOr RESEARCH <venue> | <phone> | <question> to spin a background call agent.`,
    );
    await replyOnce(phone, replies);
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  // Dual-agent research: user asks → background agent calls venue
  if (/^research\b/i.test(lower) || /^call\s+(and\s+)?ask\b/i.test(lower)) {
    const { startBackgroundResearchCall } = await import(
      "../agents/research-call"
    );
    // Format: RESEARCH Go-Kart Track | +15551212 | height limit?
    const raw = text.replace(/^(research|call\s+(and\s+)?ask)\s*/i, "");
    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      replies.push(
        "Format:\nRESEARCH Venue Name | +1phone | your question\nExample:\nRESEARCH Miami Go-Karts | +13055550100 | What's the height limit?",
      );
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
    await replyOnce(phone, [
      `On it — research agent is calling ${parts[0]} in the background. I'll text you the answer.`,
    ]);
    const job = await startBackgroundResearchCall({
      venue_name: parts[0],
      venue_phone: parts[1],
      question: parts.slice(2).join(" | "),
      reply_to_phone: phone,
      reply_channel: "whatsapp",
    });
    // If still calling (live Eleven), tell user to wait; if done (sim), already texted
    if (job.status === "calling") {
      replies.push(`Call started (${job.id.slice(0, 8)}…). Hang tight.`);
      await replyOnce(phone, [replies[replies.length - 1]]);
    } else if (job.status === "done" && job.findings) {
      // already WhatsApp'd in completeResearchJob; avoid dup if reply failed
      replies.push(job.findings);
    } else if (job.status === "failed") {
      replies.push(`Research failed: ${job.findings || "unknown"}`);
      await replyOnce(phone, [replies[replies.length - 1]]);
    }
    return { replies, user_id: contact.user_id, event_id: eventId };
  }

  if (/^(events|find|tickets|ticketmaster|packages|reconcile)\b/i.test(lower)) {
    replies.push(
      "That's agent work, not collector.\nOpen https://aidhd-omega.vercel.app and run Generate packages once prefs are in.",
    );
    await replyOnce(phone, replies);
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
      replies.push(`Hey ${contact.name} — budget for the night? (e.g. 120)`);
      await replyOnce(phone, replies);
      return { replies, user_id: contact.user_id, event_id: eventId };
    }
  }

  const before = session.messages.length;
  const result = handleCollectorMessage(eventId, contact.user_id, text);
  const newReplies = lastAssistantTexts(before, result.session.messages);

  if (newReplies.length) {
    replies.push(...newReplies);
    await replyOnce(phone, newReplies);
  }

  if (result.response) {
    const count = listResponses(eventId).length;
    const handoff =
      `Prefs locked. Handing off to AiDHD agents (${count} response${count === 1 ? "" : "s"} in).\n` +
      `They'll build Ticketmaster / flight / hotel packages + Prava mandates.\n` +
      `Demo: https://aidhd-omega.vercel.app`;
    replies.push(handoff);
    await replyOnce(phone, [handoff]);
  }

  return { replies, user_id: contact.user_id, event_id: eventId };
}
