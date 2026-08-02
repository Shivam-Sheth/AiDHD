import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { addReaction, removeReaction } from "@/lib/groups/chat-extras";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: { emoji?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const emoji = body.emoji?.trim().slice(0, 8);
  if (!emoji) {
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  }

  const reaction = await addReaction({
    groupId: id,
    messageId,
    userId: user.id,
    userName: user.name,
    emoji,
  });
  return NextResponse.json({ ok: true, reaction });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;
  const emoji = new URL(req.url).searchParams.get("emoji")?.trim();
  if (!emoji) {
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  }
  await removeReaction({ groupId: id, messageId, userId: user.id, emoji });
  return NextResponse.json({ ok: true });
}
