import { randomUUID } from "crypto";
import { getUser } from "../demo-users";
import {
  addResponse,
  getCollector,
  getEvent,
  listResponses,
  setCollector,
  upsertEvent,
} from "../store";
import type { ChatMessage, CollectorSession, Response } from "../types";

function msg(role: "assistant" | "user", content: string): ChatMessage {
  return { id: randomUUID(), role, content, ts: new Date().toISOString() };
}

function parseBudget(text: string): number | null {
  const cleaned = text.toLowerCase().replace(/,/g, "");
  if (cleaned.includes("under") && cleaned.includes("80")) return 80;
  if (cleaned.includes("80") && cleaned.includes("120")) return 120;
  if (cleaned.includes("120") && cleaned.includes("200")) return 200;
  const n = cleaned.match(/\$?\s*(\d{2,4})/);
  return n ? Number(n[1]) : null;
}

function parseTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  for (const t of [
    "brooklyn",
    "manhattan",
    "vegetarian",
    "standing",
    "seated",
    "vip",
    "quiet",
    "splurge",
  ]) {
    if (lower.includes(t)) tags.push(t);
  }
  return tags;
}

export function startCollector(eventId: string, userId: string): CollectorSession {
  const existing = getCollector(eventId, userId);
  if (existing) return existing;

  const event = getEvent(eventId);
  const user = getUser(userId);
  const session: CollectorSession = {
    user_id: userId,
    event_id: eventId,
    channel: user?.channel ?? "web",
    step: "budget",
    draft: {
      event_id: eventId,
      user_id: userId,
      channel: user?.channel ?? "web",
      budget_currency: "USD",
    },
    messages: [
      msg(
        "assistant",
        `Hey ${user?.name ?? "there"} — I'm collecting your budget and prefs for "${event?.title ?? "the outing"}". This stays on-task: budget → availability → vibe → submit.`,
      ),
      msg(
        "assistant",
        "What's your budget cap for the night? (e.g. 80, 120, 200 — or pick Under $80 / $80–$120 / $120–$200)",
      ),
    ],
  };
  setCollector(session);
  return session;
}

export function handleCollectorMessage(
  eventId: string,
  userId: string,
  text: string,
): { session: CollectorSession; response?: Response; allIn: boolean } {
  let session = getCollector(eventId, userId) ?? startCollector(eventId, userId);
  session.messages.push(msg("user", text));

  if (session.step === "budget") {
    const budget = parseBudget(text);
    if (budget == null) {
      session.messages.push(
        msg("assistant", "Couldn't parse a number — try something like 120 or $80–$120."),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.budget_cap = budget;
    session.step = "availability";
    session.messages.push(
      msg(
        "assistant",
        `Budget locked at $${budget}. Which nights work? Reply with Fri Aug 7, Sat Aug 8, or Either.`,
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "availability") {
    const lower = text.toLowerCase();
    const dates: string[] = [];
    if (lower.includes("either") || lower.includes("both")) {
      dates.push("2026-08-07", "2026-08-08");
    } else {
      if (lower.includes("fri") || lower.includes("7")) dates.push("2026-08-07");
      if (lower.includes("sat") || lower.includes("8")) dates.push("2026-08-08");
    }
    if (!dates.length) {
      session.messages.push(
        msg("assistant", "Pick Fri Aug 7, Sat Aug 8, or Either so I can schedule around it."),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.availability = dates;
    session.step = "preferences";
    session.messages.push(
      msg(
        "assistant",
        "Any vibe prefs? Free text is fine — standing room, neighborhood, food constraints, energy level…",
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "preferences") {
    session.draft.preferences = {
      free_text: text,
      structured_tags: parseTags(text),
    };
    session.step = "confirm";
    session.messages.push(
      msg(
        "assistant",
        `Confirm submit?\n• Budget: $${session.draft.budget_cap}\n• Nights: ${session.draft.availability?.join(", ")}\n• Prefs: ${text}\n\nReply YES to submit, or edit prefs.`,
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "confirm") {
    if (!/^y(es)?$/i.test(text.trim())) {
      session.step = "preferences";
      session.messages.push(
        msg("assistant", "No problem — rewrite your vibe prefs and I'll reconfirm."),
      );
      setCollector(session);
      return { session, allIn: false };
    }

    const response = addResponse({
      event_id: eventId,
      user_id: userId,
      channel: session.channel,
      budget_cap: session.draft.budget_cap!,
      budget_currency: "USD",
      preferences: session.draft.preferences!,
      availability: session.draft.availability!,
    });

    session.step = "done";
    session.messages.push(
      msg("assistant", "Submitted. Once the whole group responds, AiDHD will reconcile packages."),
    );
    setCollector(session);

    const event = getEvent(eventId);
    const responses = listResponses(eventId);
    const allIn = Boolean(
      event && responses.length >= event.invitee_ids.length,
    );
    if (allIn && event && event.status === "collecting") {
      upsertEvent({ ...event, status: "reconciling" });
    }

    return { session, response, allIn };
  }

  session.messages.push(msg("assistant", "You're already submitted for this event."));
  setCollector(session);
  return { session, allIn: listResponses(eventId).length >= 3 };
}
