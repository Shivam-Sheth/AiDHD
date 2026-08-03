import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  editMessage,
  getGroup,
  getMessage,
  listMembers,
  softDeleteMessage,
} from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit your own message. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const existing = await getMessage(id, messageId);
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  if (existing.sender_id !== user.id) {
    return NextResponse.json(
      { error: "You can only edit your own messages." },
      { status: 403 },
    );
  }
  if (existing.deleted_at) {
    return NextResponse.json({ error: "Message was deleted." }, { status: 400 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const updated = await editMessage({ groupId: id, messageId, body: text });
  return NextResponse.json({
    ok: true,
    message: updated ? { ...updated, body_ciphertext: undefined } : null,
  });
}

/** Delete your own message — owners and admins can moderate any message. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, messageId } = await ctx.params;

  const existing = await getMessage(id, messageId);
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  if (existing.sender_id !== user.id) {
    const members = await listMembers(id);
    const me = members.find((m) => m.user_id === user.id);
    const canModerate = me && (me.role === "organizer" || me.role === "admin");
    if (!canModerate) {
      return NextResponse.json(
        { error: "Only the sender, owner, or an admin can delete this." },
        { status: 403 },
      );
    }
  }

  await softDeleteMessage({ groupId: id, messageId });
  return NextResponse.json({ ok: true });
}
