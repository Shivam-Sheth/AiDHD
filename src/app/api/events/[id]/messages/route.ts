import { NextResponse } from "next/server";
import { extractReelUrl, isReelMessage } from "@/lib/reel";
import {
  addGroupMessage,
  getUserById,
  listGroupMessages,
} from "@/lib/social-store";
import { getEvent } from "@/lib/store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const messages = listGroupMessages(id).map((m) => ({
    ...m,
    user: getUserById(m.user_id) ?? null,
  }));
  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    content?: string;
    kind?: "text" | "system" | "reel" | "expense";
    meta?: Record<string, unknown>;
  };

  if (!body.user_id || !body.content?.trim()) {
    return NextResponse.json(
      { error: "user_id and content required" },
      { status: 400 },
    );
  }
  if (!event.invitee_ids.includes(body.user_id)) {
    return NextResponse.json(
      { error: "User is not in this group" },
      { status: 403 },
    );
  }

  const content = body.content.trim();
  const reelUrl = extractReelUrl(content);
  const kind =
    body.kind ??
    (reelUrl || isReelMessage(content) ? "reel" : "text");

  const message = addGroupMessage({
    event_id: id,
    user_id: body.user_id,
    content,
    kind,
    meta: {
      ...(body.meta ?? {}),
      ...(reelUrl ? { reel_url: reelUrl } : {}),
    },
  });

  return NextResponse.json(
    {
      message: {
        ...message,
        user: getUserById(message.user_id) ?? null,
      },
      messages: listGroupMessages(id).map((m) => ({
        ...m,
        user: getUserById(m.user_id) ?? null,
      })),
    },
    { status: 201 },
  );
}
