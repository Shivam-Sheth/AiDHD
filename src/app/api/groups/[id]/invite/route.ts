import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  findProfileByEmail,
  findProfileByPhone,
  findProfileByUsername,
} from "@/lib/groups/directory";
import {
  addMember,
  createInvite,
  getGroup,
  isMember,
} from "@/lib/groups/store";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite people to the group:
 * - no body / {}                 → shareable web link (existing behavior)
 * - { username }                 → existing user joins immediately
 * - { email }                    → targeted 1-use invite (+ in-app notification
 *                                  if that email already has a profile)
 * - { phone }                    → targeted 1-use invite, texted via Linq when
 *                                  configured
 * - { role: "admin" }            → invitee joins as admin (owner/admin only)
 */
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

  let body: {
    email?: string;
    phone?: string;
    username?: string;
    role?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // plain link invite
  }

  const role = body.role === "admin" ? "admin" : "member";
  const origin = new URL(req.url).origin;

  // Username → existing member of the platform joins right away.
  if (body.username?.trim()) {
    const profile = await findProfileByUsername(body.username);
    if (!profile) {
      return NextResponse.json(
        { error: `No user with username "${body.username.trim()}".` },
        { status: 404 },
      );
    }
    if (await isMember(id, profile.id)) {
      return NextResponse.json({ ok: true, already_member: true });
    }
    const member = await addMember({
      groupId: id,
      userId: profile.id,
      displayName: profile.name || profile.username || "Member",
      email: profile.email,
      phone: profile.phone || undefined,
      role,
    });
    await notifyUser({
      userId: profile.id,
      kind: "group_invite",
      title: `${user.name} added you to "${group.title}"`,
      body: "Open the group chat to say hi.",
      link: `/groups/${id}`,
      groupId: id,
    });
    return NextResponse.json({ ok: true, member });
  }

  const invite = await createInvite(id, user.id, {
    email: body.email?.trim() || undefined,
    phone: body.phone?.trim() || undefined,
    role,
  });
  const inviteUrl = `${origin}/invite/${invite.token}`;

  // Email invite → notify in-app when the email already has an account.
  if (body.email?.trim()) {
    const profile = await findProfileByEmail(body.email);
    if (profile) {
      await notifyUser({
        userId: profile.id,
        kind: "group_invite",
        title: `${user.name} invited you to "${group.title}"`,
        body: "Tap to join the group.",
        link: `/invite/${invite.token}`,
        groupId: id,
      });
    }
    return NextResponse.json({
      invite,
      invite_url: inviteUrl,
      notified: Boolean(profile),
      mailto: `mailto:${encodeURIComponent(body.email.trim())}?subject=${encodeURIComponent(
        `Join "${group.title}"`,
      )}&body=${encodeURIComponent(`${user.name} invited you: ${inviteUrl}`)}`,
    });
  }

  // Phone invite → text the link via Linq when configured.
  if (body.phone?.trim()) {
    let texted = false;
    try {
      const { hasLinq } = await import("@/lib/integrations/config");
      if (hasLinq()) {
        const { createLinqChat } = await import("@/lib/integrations/linq");
        const sent = await createLinqChat({
          to: [body.phone.trim()],
          text: `${user.name} invited you to "${group.title}" — join here: ${inviteUrl}`,
        });
        texted = sent.ok;
      }
    } catch {
      // non-fatal
    }
    const profile = await findProfileByPhone(body.phone);
    if (profile) {
      await notifyUser({
        userId: profile.id,
        kind: "group_invite",
        title: `${user.name} invited you to "${group.title}"`,
        body: "Tap to join the group.",
        link: `/invite/${invite.token}`,
        groupId: id,
      });
    }
    return NextResponse.json({
      invite,
      invite_url: inviteUrl,
      texted,
      notified: Boolean(profile),
    });
  }

  return NextResponse.json({ invite, invite_url: inviteUrl });
}
