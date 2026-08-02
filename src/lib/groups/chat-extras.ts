/**
 * Chat extras — reactions and read receipts.
 * Supabase (service role) when configured, in-memory fallback otherwise —
 * same pattern as groups/store.ts.
 */

import { broadcastGroupEvent } from "@/lib/realtime/broadcast";
import { sb, supabaseConfigured } from "./store";
import type { MessageReaction, MessageRead } from "./types";

type ExtrasMemory = {
  /** group_id → reactions */
  reactions: Map<string, MessageReaction[]>;
  /** `${group_id}:${user_id}` → read watermark */
  reads: Map<string, MessageRead>;
};

const g = globalThis as unknown as { __aidhdChatExtras?: ExtrasMemory };

function mem(): ExtrasMemory {
  if (!g.__aidhdChatExtras) {
    g.__aidhdChatExtras = { reactions: new Map(), reads: new Map() };
  }
  return g.__aidhdChatExtras;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export async function addReaction(input: {
  groupId: string;
  messageId: string;
  userId: string;
  userName: string;
  emoji: string;
}): Promise<MessageReaction> {
  const reaction: MessageReaction = {
    message_id: input.messageId,
    group_id: input.groupId,
    user_id: input.userId,
    user_name: input.userName,
    emoji: input.emoji,
    created_at: new Date().toISOString(),
  };

  if (supabaseConfigured()) {
    await sb("message_reactions", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        message_id: reaction.message_id,
        group_id: reaction.group_id,
        user_id: reaction.user_id,
        user_name: reaction.user_name,
        emoji: reaction.emoji,
      }),
    });
  }

  const list = mem().reactions.get(input.groupId) ?? [];
  if (
    !list.some(
      (r) =>
        r.message_id === reaction.message_id &&
        r.user_id === reaction.user_id &&
        r.emoji === reaction.emoji,
    )
  ) {
    list.push(reaction);
    mem().reactions.set(input.groupId, list);
  }

  await broadcastGroupEvent(input.groupId, "reaction", {
    message_id: input.messageId,
  });
  return reaction;
}

export async function removeReaction(input: {
  groupId: string;
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  if (supabaseConfigured()) {
    await sb(
      `message_reactions?message_id=eq.${input.messageId}` +
        `&user_id=eq.${encodeURIComponent(input.userId)}` +
        `&emoji=eq.${encodeURIComponent(input.emoji)}`,
      { method: "DELETE" },
    );
  }
  const list = mem().reactions.get(input.groupId) ?? [];
  mem().reactions.set(
    input.groupId,
    list.filter(
      (r) =>
        !(
          r.message_id === input.messageId &&
          r.user_id === input.userId &&
          r.emoji === input.emoji
        ),
    ),
  );
  await broadcastGroupEvent(input.groupId, "reaction", {
    message_id: input.messageId,
  });
}

export async function listReactions(
  groupId: string,
): Promise<MessageReaction[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `message_reactions?group_id=eq.${groupId}&order=created_at.asc&limit=1000`,
    );
    if (ok && Array.isArray(data)) {
      const reactions = (data as Record<string, unknown>[]).map((row) => ({
        message_id: String(row.message_id),
        group_id: String(row.group_id),
        user_id: String(row.user_id),
        user_name: String(row.user_name ?? ""),
        emoji: String(row.emoji),
        created_at: String(row.created_at),
      }));
      mem().reactions.set(groupId, reactions);
      return reactions;
    }
  }
  return mem().reactions.get(groupId) ?? [];
}

// ---------------------------------------------------------------------------
// Read receipts / unread counts
// ---------------------------------------------------------------------------

export async function markRead(input: {
  groupId: string;
  userId: string;
  lastMessageId?: string;
}): Promise<MessageRead> {
  const read: MessageRead = {
    group_id: input.groupId,
    user_id: input.userId,
    last_read_at: new Date().toISOString(),
    last_read_message_id: input.lastMessageId ?? null,
  };

  if (supabaseConfigured()) {
    await sb("message_reads?on_conflict=group_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        group_id: read.group_id,
        user_id: read.user_id,
        last_read_at: read.last_read_at,
        last_read_message_id: read.last_read_message_id,
      }),
    });
  }
  mem().reads.set(`${input.groupId}:${input.userId}`, read);

  await broadcastGroupEvent(input.groupId, "read", { user_id: input.userId });
  return read;
}

export async function listReads(groupId: string): Promise<MessageRead[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(`message_reads?group_id=eq.${groupId}`);
    if (ok && Array.isArray(data)) {
      return (data as Record<string, unknown>[]).map((row) => ({
        group_id: String(row.group_id),
        user_id: String(row.user_id),
        last_read_at: String(row.last_read_at),
        last_read_message_id:
          (row.last_read_message_id as string | null) ?? null,
      }));
    }
  }
  const out: MessageRead[] = [];
  for (const [key, read] of mem().reads) {
    if (key.startsWith(`${groupId}:`)) out.push(read);
  }
  return out;
}

/** Unread message count per group for one user (for list badges). */
export async function unreadCounts(
  userId: string,
  groupIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!groupIds.length) return out;

  if (supabaseConfigured()) {
    const idsFilter = `in.(${groupIds.join(",")})`;
    const [reads, msgs] = await Promise.all([
      sb(
        `message_reads?user_id=eq.${encodeURIComponent(userId)}&group_id=${idsFilter}`,
      ),
      sb(
        `group_messages?group_id=${idsFilter}&select=group_id,created_at,sender_id&order=created_at.desc&limit=600`,
      ),
    ]);
    const watermarks = new Map<string, string>();
    if (reads.ok && Array.isArray(reads.data)) {
      for (const row of reads.data as Record<string, unknown>[]) {
        watermarks.set(String(row.group_id), String(row.last_read_at));
      }
    }
    if (msgs.ok && Array.isArray(msgs.data)) {
      for (const row of msgs.data as Record<string, unknown>[]) {
        const gid = String(row.group_id);
        if (String(row.sender_id) === userId) continue;
        const mark = watermarks.get(gid);
        if (!mark || String(row.created_at) > mark) {
          out[gid] = (out[gid] ?? 0) + 1;
        }
      }
    }
    return out;
  }

  return out;
}
