import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  appendMessage,
  getGroup,
  listMembers,
  removeMember,
  setMemberRole,
} from "@/lib/groups/store";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
  type MemberRole,
} from "@/lib/groups/types";
import { broadcastGroupEvent } from "@/lib/realtime/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function callerRole(groupId: string, userId: string) {
  const members = await listMembers(groupId);
  return members.find((m) => m.user_id === userId)?.role ?? null;
}

/** Change a member's role. Owner can set admin/member; admins can set member↔spoc. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, userId } = await ctx.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const myRole = await callerRole(id, user.id);
  if (!myRole || (myRole !== "organizer" && myRole !== "admin")) {
    return NextResponse.json(
      { error: "Only the owner or an admin can change roles." },
      { status: 403 },
    );
  }

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body.role as MemberRole;
  if (!["admin", "member", "spoc"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, member, or spoc" },
      { status: 400 },
    );
  }
  if (role === "admin" && myRole !== "organizer") {
    return NextResponse.json(
      { error: "Only the owner can grant admin." },
      { status: 403 },
    );
  }
  if (userId === group.organizer_id) {
    return NextResponse.json(
      { error: "The owner's role can't be changed." },
      { status: 400 },
    );
  }

  const members = await listMembers(id);
  const target = members.find((m) => m.user_id === userId);
  if (!target || target.role === "bot") {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await setMemberRole(id, userId, role);
  await appendMessage({
    groupId: id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: `${target.display_name} is now ${role === "spoc" ? "the SPOC" : `a ${role}`}.`,
    kind: "system",
  });
  await broadcastGroupEvent(id, "member", { user_id: userId, role });
  return NextResponse.json({ ok: true });
}

/** Remove a member (owner/admin, or leave the group yourself). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, userId } = await ctx.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }
  if (userId === group.organizer_id) {
    return NextResponse.json(
      { error: "The owner can't be removed." },
      { status: 400 },
    );
  }

  const myRole = await callerRole(id, user.id);
  const isSelf = user.id === userId;
  if (!isSelf && myRole !== "organizer" && myRole !== "admin") {
    return NextResponse.json(
      { error: "Only the owner or an admin can remove members." },
      { status: 403 },
    );
  }

  const members = await listMembers(id);
  const target = members.find((m) => m.user_id === userId);
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await removeMember(id, userId);

  await appendMessage({
    groupId: id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: isSelf
      ? `${target.display_name} left the group.`
      : `${target.display_name} was removed from the group.`,
    kind: "system",
  });
  await broadcastGroupEvent(id, "member", { user_id: userId, removed: true });
  return NextResponse.json({ ok: true });
}
