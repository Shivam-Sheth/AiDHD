import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as repo from "@/lib/db/repo";
import type { Profile, TripGroup } from "@/lib/db/types";
import { completeChat } from "@/lib/integrations/chat-llm";
import { extractReelUrl, isReelMessage } from "@/lib/reel";
import { upsertEvent } from "@/lib/store";
import type { Event } from "@/lib/types";
import { getPassportRef } from "@/lib/vault/traveler-store";

export type AgentAction =
  | { type: "reply"; text: string }
  | {
      type: "update_trip";
      destination?: string;
      name?: string;
      dates?: string[];
      budget_per_person?: number;
      notes?: string;
    }
  | { type: "start_booking"; summary: string }
  | { type: "add_expense"; description: string; amount: number; paid_by_name?: string }
  | { type: "noop" };

function shouldEngage(content: string, force: boolean): boolean {
  if (force) return true;
  const t = content.toLowerCase();
  if (/(^|\s)@?aidhd\b/.test(t)) return true;
  if (/\b(plan|book|flight|hotel|split|budget|itinerary|weekend|trip|reel)\b/.test(t)) {
    return true;
  }
  if (isReelMessage(content) || extractReelUrl(content)) return true;
  if (/\?/.test(content)) return true;
  return false;
}

function parseActions(raw: string): AgentAction[] {
  try {
    const json = JSON.parse(raw) as { actions?: AgentAction[]; reply?: string };
    if (Array.isArray(json.actions) && json.actions.length) return json.actions;
    if (json.reply) return [{ type: "reply", text: json.reply }];
  } catch {
    /* fall through */
  }
  const text = raw.trim();
  if (!text) return [{ type: "noop" }];
  return [{ type: "reply", text }];
}

async function ensureBookingEvent(
  admin: SupabaseClient | null,
  group: TripGroup,
  members: Profile[],
  brief: Record<string, unknown>,
): Promise<string> {
  if (group.booking_event_id) return group.booking_event_id;

  const event: Event = {
    id: `evt_group_${group.id}`,
    type: "trip",
    title: group.name,
    destination_or_venue:
      (brief.destination as string) || group.destination || "TBD",
    proposed_dates: Array.isArray(brief.dates)
      ? (brief.dates as string[])
      : [],
    organizer_id: group.created_by,
    invitee_ids: members.map((m) => m.id),
    status: "collecting",
    created_via: "web",
    created_at: new Date().toISOString(),
  };
  upsertEvent(event);
  await repo.updateGroup(admin, group.id, {
    booking_event_id: event.id,
    status: "collecting",
  });
  return event.id;
}

export async function runGroupAgent(input: {
  admin: SupabaseClient | null;
  groupId: string;
  triggerUserId: string;
  triggerContent: string;
  force?: boolean;
}): Promise<{ engaged: boolean; reply?: string; actions: AgentAction[] }> {
  if (!shouldEngage(input.triggerContent, Boolean(input.force))) {
    return { engaged: false, actions: [] };
  }

  const group = await repo.getGroup(input.admin, input.groupId);
  if (!group) return { engaged: false, actions: [] };

  const memberRows = await repo.listMembers(input.admin, input.groupId);
  const members = memberRows
    .map((m) => m.profile)
    .filter((p): p is Profile => Boolean(p));
  const messages = await repo.listMessages(input.admin, input.groupId, 40);

  const vaultHints = await Promise.all(
    members.map(async (m) => {
      const ref = await getPassportRef(m.id);
      return {
        name: m.name || m.handle || m.email,
        passport_on_file: ref.present,
      };
    }),
  );

  const transcript = messages
    .map((m) => {
      const who =
        m.kind === "agent"
          ? "AiDHD"
          : m.kind === "system"
            ? "System"
            : m.profile?.name || "Member";
      return `${who}: ${m.content}`;
    })
    .join("\n");

  const system = `You are AiDHD, the Meta-AI-style trip agent sitting inside a group chat.
You understand the full conversation, help friends plan trips/outings, split costs, and move them toward booking.
Never ask for or repeat passport numbers, full card numbers, or CVV. You may note whether a passport is on file.
Be concise, warm, and actionable. Prefer concrete next steps.

Return ONLY a JSON object:
{
  "actions": [
    { "type": "reply", "text": "message to post in the group" },
    { "type": "update_trip", "destination": "City", "name": "optional title", "dates": ["YYYY-MM-DD"], "budget_per_person": 200, "notes": "..." },
    { "type": "start_booking", "summary": "why we are ready to collect prefs / book" },
    { "type": "add_expense", "description": "...", "amount": 42.5, "paid_by_name": "Maya" },
    { "type": "noop" }
  ]
}
Always include one "reply" action when you engage.
If someone pastes an Instagram/TikTok reel, acknowledge it and extract destination/vibe into update_trip when possible.`;

  const user = `Group: ${group.name}
Destination: ${group.destination}
Status: ${group.status}
Trip brief: ${JSON.stringify(group.trip_brief || {})}
Booking event: ${group.booking_event_id || "none"}
Members: ${JSON.stringify(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      handle: m.handle,
      email: m.email,
    })),
  )}
Passport vault (presence only): ${JSON.stringify(vaultHints)}

Recent chat:
${transcript}

Latest message from trigger user ${input.triggerUserId}:
${input.triggerContent}`;

  const llm = await completeChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
  });

  let actions: AgentAction[];
  if (!llm) {
    actions = [
      {
        type: "reply",
        text: "I'm here — set OPENAI_API_KEY (or GEMINI_API_KEY) so I can plan from this chat. Meanwhile tell me destination, dates, and budget.",
      },
    ];
  } else {
    actions = parseActions(llm.text);
  }

  let replyText: string | undefined;
  let brief = { ...(group.trip_brief || {}) } as Record<string, unknown>;

  for (const action of actions) {
    if (action.type === "reply") {
      replyText = action.text;
      await repo.addMessage(input.admin, {
        group_id: input.groupId,
        user_id: null,
        content: action.text,
        kind: "agent",
        meta: { provider: llm?.provider ?? "none" },
      });
    }

    if (action.type === "update_trip") {
      if (action.destination) brief.destination = action.destination;
      if (action.dates) brief.dates = action.dates;
      if (action.budget_per_person != null) {
        brief.budget_per_person = action.budget_per_person;
      }
      if (action.notes) brief.notes = action.notes;
      const reel = extractReelUrl(input.triggerContent);
      if (reel) brief.source_reel_url = reel;

      await repo.updateGroup(input.admin, input.groupId, {
        destination: (brief.destination as string) || group.destination,
        name: action.name?.trim() || group.name,
        trip_brief: brief,
        source_reel_url: reel || group.source_reel_url,
      });
    }

    if (action.type === "start_booking") {
      const eventId = await ensureBookingEvent(
        input.admin,
        group,
        members,
        brief,
      );
      await repo.addMessage(input.admin, {
        group_id: input.groupId,
        user_id: null,
        content: `Booking lane opened (${eventId}). ${action.summary} Each person should share budget + availability in Concierge or reply here — I'll keep the group synced.`,
        kind: "agent",
        meta: { booking_event_id: eventId },
      });
      if (!replyText) replyText = action.summary;
    }

    if (action.type === "add_expense") {
      const payer =
        members.find(
          (m) =>
            m.name?.toLowerCase() === action.paid_by_name?.toLowerCase() ||
            m.handle?.toLowerCase() === action.paid_by_name?.toLowerCase(),
        ) || members.find((m) => m.id === input.triggerUserId) || members[0];
      if (payer && action.amount > 0) {
        const ids = members.map((m) => m.id);
        const cents = Math.round(action.amount * 100);
        const base = Math.floor(cents / ids.length);
        let rem = cents - base * ids.length;
        const splits = ids.map((user_id) => {
          const extra = rem > 0 ? 1 : 0;
          if (rem > 0) rem -= 1;
          return { user_id, amount: (base + extra) / 100 };
        });
        await repo.addExpense(input.admin, {
          group_id: input.groupId,
          description: action.description || "Shared cost",
          amount: Math.round(action.amount * 100) / 100,
          currency: "USD",
          paid_by: payer.id,
          splits,
          category: null,
          source: "agent",
        });
        await repo.addMessage(input.admin, {
          group_id: input.groupId,
          user_id: null,
          content: `Logged $${action.amount.toFixed(2)} — ${action.description} (paid by ${payer.name}). Split equally.`,
          kind: "expense",
          meta: { amount: action.amount },
        });
      }
    }
  }

  // Always capture reel links even if model returned noop
  const reelUrl = extractReelUrl(input.triggerContent);
  if (reelUrl && !brief.source_reel_url) {
    brief.source_reel_url = reelUrl;
    await repo.updateGroup(input.admin, input.groupId, {
      source_reel_url: reelUrl,
      trip_brief: brief,
    });
  }

  return {
    engaged: true,
    reply: replyText,
    actions,
  };
}

export function agentMessageId() {
  return randomUUID();
}
