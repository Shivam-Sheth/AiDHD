/**
 * Group polls — created by members or by @Prava (e.g. "make a poll for
 * Friday vs Saturday"). Supabase when configured, memory fallback otherwise.
 */

import { randomUUID } from "crypto";
import { broadcastGroupEvent } from "@/lib/realtime/broadcast";
import { appendMessage, sb, supabaseConfigured } from "./store";
import type { GroupPoll, PollVote } from "./types";

type PollsMemory = {
  polls: Map<string, GroupPoll>;
  votes: Map<string, PollVote[]>;
};

const g = globalThis as unknown as { __aidhdPolls?: PollsMemory };

function mem(): PollsMemory {
  if (!g.__aidhdPolls) g.__aidhdPolls = { polls: new Map(), votes: new Map() };
  return g.__aidhdPolls;
}

function rowToPoll(row: Record<string, unknown>): GroupPoll {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    message_id: (row.message_id as string | null) ?? null,
    question: String(row.question),
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    created_by: String(row.created_by),
    status: (row.status as "open" | "closed") ?? "open",
    closes_at: (row.closes_at as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export async function createPoll(input: {
  groupId: string;
  question: string;
  options: string[];
  createdBy: string;
  createdByName: string;
  announce?: boolean;
}): Promise<GroupPoll> {
  const poll: GroupPoll = {
    id: randomUUID(),
    group_id: input.groupId,
    message_id: null,
    question: input.question.trim(),
    options: input.options.map((o) => o.trim()).filter(Boolean).slice(0, 8),
    created_by: input.createdBy,
    status: "open",
    closes_at: null,
    created_at: new Date().toISOString(),
  };

  if (input.announce !== false) {
    const msg = await appendMessage({
      groupId: input.groupId,
      senderId: input.createdBy,
      senderName: input.createdByName,
      body: `📊 Poll: ${poll.question}\n${poll.options
        .map((o, i) => `${i + 1}. ${o}`)
        .join("\n")}`,
      kind: "poll",
      meta: { poll_id: poll.id, question: poll.question, options: poll.options },
    });
    poll.message_id = msg?.id ?? null;
  }

  if (supabaseConfigured()) {
    await sb("group_polls", {
      method: "POST",
      body: JSON.stringify({
        id: poll.id,
        group_id: poll.group_id,
        message_id: poll.message_id,
        question: poll.question,
        options: poll.options,
        created_by: poll.created_by,
        status: poll.status,
      }),
    });
  }
  mem().polls.set(poll.id, poll);
  await broadcastGroupEvent(input.groupId, "poll", { poll_id: poll.id });
  return poll;
}

export async function getPoll(pollId: string): Promise<GroupPoll | null> {
  let poll: GroupPoll | null = null;
  if (supabaseConfigured()) {
    const { ok, data } = await sb(`group_polls?id=eq.${pollId}&limit=1`);
    if (ok && Array.isArray(data) && data[0]) {
      poll = rowToPoll(data[0] as Record<string, unknown>);
    }
  }
  if (!poll) poll = mem().polls.get(pollId) ?? null;
  if (!poll) return null;
  poll.votes = await listVotes(pollId);
  return poll;
}

export async function listPolls(groupId: string): Promise<GroupPoll[]> {
  let polls: GroupPoll[] = [];
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_polls?group_id=eq.${groupId}&order=created_at.desc&limit=20`,
    );
    if (ok && Array.isArray(data)) {
      polls = (data as Record<string, unknown>[]).map(rowToPoll);
    }
  }
  if (!polls.length) {
    polls = [...mem().polls.values()]
      .filter((p) => p.group_id === groupId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  for (const p of polls) {
    p.votes = await listVotes(p.id);
  }
  return polls;
}

async function listVotes(pollId: string): Promise<PollVote[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(`group_poll_votes?poll_id=eq.${pollId}`);
    if (ok && Array.isArray(data)) {
      return (data as Record<string, unknown>[]).map((row) => ({
        poll_id: String(row.poll_id),
        user_id: String(row.user_id),
        user_name: String(row.user_name ?? ""),
        option_index: Number(row.option_index ?? 0),
        created_at: String(row.created_at),
      }));
    }
  }
  return mem().votes.get(pollId) ?? [];
}

export async function votePoll(input: {
  pollId: string;
  groupId: string;
  userId: string;
  userName: string;
  optionIndex: number;
}): Promise<GroupPoll | null> {
  const vote: PollVote = {
    poll_id: input.pollId,
    user_id: input.userId,
    user_name: input.userName,
    option_index: input.optionIndex,
    created_at: new Date().toISOString(),
  };

  if (supabaseConfigured()) {
    await sb("group_poll_votes?on_conflict=poll_id,user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        poll_id: vote.poll_id,
        user_id: vote.user_id,
        user_name: vote.user_name,
        option_index: vote.option_index,
      }),
    });
  }
  const list = (mem().votes.get(input.pollId) ?? []).filter(
    (v) => v.user_id !== input.userId,
  );
  list.push(vote);
  mem().votes.set(input.pollId, list);

  await broadcastGroupEvent(input.groupId, "poll", { poll_id: input.pollId });
  return getPoll(input.pollId);
}
