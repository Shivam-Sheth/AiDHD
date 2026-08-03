/**
 * Linq (iMessage) group thread ⇄ Prava group party.
 *
 * A Linq chat created with several recipients IS a group iMessage thread, and
 * our number sits in it like any other participant. This bridges that thread to
 * a real group party so the iMessage side gets the same @Prava as the web app:
 * same LLM, same chat history, same approval gates — not the 1:1 slot-filling
 * collector in linq-bot.ts, which has no group context and no model behind it.
 *
 * Messages flow both ways, so web members and iMessage members are in one
 * conversation and @Prava reads all of it as context.
 */

import { maybeHandleAgentMention } from "@/lib/groups/agent";
import { extractMentions, mentionsAidhd } from "@/lib/groups/mentions";
import {
  addMember,
  appendMessage,
  findMemberByPhone,
  getGroupByLinqChat,
  listMessages,
} from "@/lib/groups/store";
import { AIDHD_BOT_ID } from "@/lib/groups/types";
import { isOptOut, sendLinqChatMessage } from "@/lib/integrations/linq";

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || "https://aidhd-omega.vercel.app";

/**
 * Distinct inbound handles per chat — a thread that has heard from two
 * different people is a group, whatever the payload says. Memory-only on
 * purpose: it re-learns after a cold start and is only a safety net.
 */
const seenSenders = new Map<string, Set<string>>();

/**
 * Is this Linq thread a group chat?
 *
 * Matters because an *unlinked* thread falls through to the 1:1 collector,
 * which answers every message it sees. That is fine in a two-person thread and
 * awful in someone's friend group, so group threads stay quiet until tagged.
 *
 * Participant lists come back under several key names and sometimes include our
 * own number, so count handles that aren't ours: 2+ others means group.
 */
export function looksLikeGroupThread(input: {
  chatId: string;
  fromPhone?: string;
  data?: Record<string, unknown>;
}): boolean {
  const data = input.data || {};
  const chat = (data.chat as Record<string, unknown>) || {};

  if (chat.is_group === true || data.is_group === true) return true;

  const ours = (process.env.LINQ_PHONE_NUMBER || "").replace(/\D/g, "");
  const handleOf = (p: unknown): string => {
    if (typeof p === "string") return p;
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      return String(o.handle || o.phone || o.number || o.id || "");
    }
    return "";
  };

  for (const key of ["participants", "handles", "recipients", "members", "to"]) {
    const arr = chat[key] ?? data[key];
    if (!Array.isArray(arr)) continue;
    const others = arr
      .map(handleOf)
      .map((h) => h.replace(/\D/g, ""))
      .filter((h) => h && h !== ours);
    if (new Set(others).size >= 2) return true;
  }

  // Fallback: remember who has spoken in this thread.
  const digits = (input.fromPhone || "").replace(/\D/g, "");
  if (input.chatId && digits) {
    const set = seenSenders.get(input.chatId) || new Set<string>();
    set.add(digits);
    seenSenders.set(input.chatId, set);
    if (set.size >= 2) return true;
  }

  return false;
}

/** iMessage has no 1000-char etiquette but a wall of text still reads badly. */
function forImessage(text: string): string {
  const t = text.trim();
  return t.length > 1200 ? `${t.slice(0, 1190)}…` : t;
}

/**
 * Push group messages out to the iMessage thread. Used for agent replies and to
 * mirror what web members say, so the iMessage side sees the whole conversation.
 */
export async function mirrorToLinqThread(input: {
  chatId: string;
  lines: string[];
}): Promise<number> {
  let sent = 0;
  for (const line of input.lines) {
    const text = forImessage(line);
    if (!text) continue;
    const res = await sendLinqChatMessage({ chat_id: input.chatId, text });
    if (res.ok) {
      sent += 1;
    } else {
      console.error("[linq-group] send failed", res.status, res.data);
    }
  }
  return sent;
}

/**
 * Inbound iMessage in a thread that belongs to a group party.
 * Returns handled:false when this chat isn't linked, so the caller can fall
 * back to the 1:1 collector.
 */
export async function handleLinqGroupInbound(msg: {
  chat_id: string;
  from_phone: string;
  text: string;
  origin?: string;
}): Promise<{ handled: boolean; group_id?: string; replies: string[] }> {
  const group = await getGroupByLinqChat(msg.chat_id);
  if (!group) return { handled: false, replies: [] };

  // Opt-out still wins over everything, including group membership.
  if (isOptOut(msg.text)) {
    return { handled: true, group_id: group.id, replies: [] };
  }

  // Resolve the texter. Unknown numbers in a linked thread are real
  // participants — Linq only delivers messages from people in the chat.
  const digits = (msg.from_phone || "").replace(/\D/g, "");
  let member = digits ? await findMemberByPhone(group.id, msg.from_phone) : null;
  if (!member && digits) {
    member = await addMember({
      groupId: group.id,
      userId: `im_${digits}`,
      displayName: msg.from_phone,
      phone: msg.from_phone,
      channel: "imessage",
    });
  }

  const senderId = member?.user_id || `im_${digits || "unknown"}`;
  const senderName = member?.display_name || msg.from_phone || "iMessage guest";

  const inbound = await appendMessage({
    groupId: group.id,
    senderId,
    senderName,
    body: msg.text,
    kind: "text",
    mentions: extractMentions(msg.text),
    meta: { channel: "imessage", linq_chat_id: msg.chat_id },
  });

  if (!mentionsAidhd(msg.text)) {
    // Not tagged — it still belongs in the group history as context for the
    // next time someone does tag @Prava.
    return { handled: true, group_id: group.id, replies: [] };
  }

  await maybeHandleAgentMention({
    group,
    senderId,
    senderName,
    body: msg.text,
    origin: msg.origin || APP_ORIGIN,
  });

  // Everything Prava posted after the inbound message goes back to the thread.
  const after = await listMessages(group.id, 40);
  const cut = inbound ? after.findIndex((m) => m.id === inbound.id) : -1;
  const fresh = (cut >= 0 ? after.slice(cut + 1) : after.slice(-3)).filter(
    (m) => m.sender_id === AIDHD_BOT_ID && (m.body || "").trim(),
  );

  const replies = fresh.map((m) => m.body!.trim());
  await mirrorToLinqThread({ chatId: msg.chat_id, lines: replies });

  return { handled: true, group_id: group.id, replies };
}
