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
import type { Channel, ChatMessage, CollectorSession, Response } from "../types";

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

export function startCollector(
  eventId: string,
  userId: string,
  opts?: { channel?: Channel; name?: string },
): CollectorSession {
  const existing = getCollector(eventId, userId);
  if (existing) return existing;

  const event = getEvent(eventId);
  const user = getUser(userId);
  const channel = opts?.channel ?? user?.channel ?? "web";
  const name = opts?.name ?? user?.name ?? "there";
  const session: CollectorSession = {
    user_id: userId,
    event_id: eventId,
    channel,
    step: "budget",
    draft: {
      event_id: eventId,
      user_id: userId,
      channel,
      budget_currency: "USD",
    },
    messages:
      channel === "whatsapp"
        ? [
            msg(
              "assistant",
              `Hey ${name} — budget for "${event?.title ?? "the outing"}"? (e.g. 120)`,
            ),
          ]
        : [
            msg(
              "assistant",
              `Hey ${name} — I'm collecting your budget and prefs for "${event?.title ?? "the outing"}". This stays on-task: budget → availability → vibe → submit. Text EVENTS anytime for Ticketmaster picks, or HELP for commands.`,
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
        session.channel === "whatsapp"
          ? `Got $${budget}. Nights: Fri Aug 7, Sat Aug 8, or Either?`
          : `Budget locked at $${budget}. Which nights work? Reply with Fri Aug 7, Sat Aug 8, or Either.`,
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "availability") {
    const lower = text.toLowerCase().replace(/,/g, " ");
    const dates: string[] = [];
    if (
      lower.includes("either") ||
      lower.includes("both") ||
      lower.includes("any") ||
      lower.includes("whenever")
    ) {
      dates.push("2026-08-07", "2026-08-08");
    } else {
      const fri =
        /\bfri(day)?\b/.test(lower) ||
        /\baug(ust)?\s*7\b/.test(lower) ||
        /\b08[\/-]0?7\b/.test(lower) ||
        /\b2026-08-07\b/.test(lower) ||
        /\b7(th)?\b/.test(lower);
      const sat =
        /\bsat(urday)?\b/.test(lower) ||
        /\baug(ust)?\s*8\b/.test(lower) ||
        /\b08[\/-]0?8\b/.test(lower) ||
        /\b2026-08-08\b/.test(lower) ||
        /\b8(th)?\b/.test(lower);
      // Bare "7" / "8" alone
      if (fri) dates.push("2026-08-07");
      if (sat) dates.push("2026-08-08");
      if (!dates.length && /^\s*7\s*$/.test(lower)) dates.push("2026-08-07");
      if (!dates.length && /^\s*8\s*$/.test(lower)) dates.push("2026-08-08");
    }
    // de-dupe
    const uniq = [...new Set(dates)];
    if (!uniq.length) {
      session.messages.push(
        msg(
          "assistant",
          session.channel === "whatsapp"
            ? "Which night — Fri Aug 7, Sat Aug 8, or Either?"
            : "Pick Fri Aug 7, Sat Aug 8, or Either so I can schedule around it.",
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.availability = uniq;
    session.step = "preferences";
    session.messages.push(
      msg(
        "assistant",
        session.channel === "whatsapp"
          ? "Vibe prefs? (e.g. Brooklyn, vegetarian, standing ok)"
          : "Any vibe prefs? Free text is fine — standing room, neighborhood, food constraints, energy level…",
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
        session.channel === "whatsapp"
          ? `Confirm?\n$${session.draft.budget_cap} · ${session.draft.availability?.join(", ")} · ${text}\nReply YES`
          : `Confirm submit?\n• Budget: $${session.draft.budget_cap}\n• Nights: ${session.draft.availability?.join(", ")}\n• Prefs: ${text}\n\nReply YES to submit, or edit prefs.`,
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
