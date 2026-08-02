import { NextResponse } from "next/server";
import { maybeHandleAgentMention } from "@/lib/groups/agent";
import { resolveGroupUser } from "@/lib/groups/auth";
import { listReactions, listReads } from "@/lib/groups/chat-extras";
import { extractMentions } from "@/lib/groups/mentions";
import {
  appendMessage,
  getGroup,
  isMember,
  listMessages,
} from "@/lib/groups/store";
import type { GroupMessage } from "@/lib/groups/types";

async function decoratedMessages(groupId: string) {
  const [messages, reactions, reads] = await Promise.all([
    listMessages(groupId),
    listReactions(groupId),
    listReads(groupId),
  ]);
  const byMessage = new Map<string, GroupMessage["reactions"]>();
  for (const r of reactions) {
    const list = byMessage.get(r.message_id) ?? [];
    list!.push(r);
    byMessage.set(r.message_id, list);
  }
  return {
    messages: messages.map(({ body_ciphertext: _, ...rest }) => ({
      ...rest,
      reactions: byMessage.get(rest.id) ?? [],
    })),
    reads,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }
  const { messages, reads } = await decoratedMessages(id);
  return NextResponse.json({ messages, reads });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: { text?: string; reply_to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const mentions = extractMentions(text);
  const message = await appendMessage({
    groupId: id,
    senderId: user.id,
    senderName: user.name,
    body: text,
    kind: "text",
    mentions,
    replyTo: body.reply_to,
  });

  const origin = new URL(req.url).origin;
  const agent = await maybeHandleAgentMention({
    group,
    senderId: user.id,
    senderName: user.name,
    body: text,
    origin,
  });

  const { messages, reads } = await decoratedMessages(id);
  return NextResponse.json({
    message: message
      ? { ...message, body_ciphertext: undefined }
      : null,
    agent_handled: agent.handled,
    messages,
    reads,
  });
}
