import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  addMember,
  consumeInvite,
  getGroup,
  getInvite,
  listMembers,
} from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  const group = await getGroup(invite.group_id);
  if (!group) {
    return NextResponse.json({ error: "Group gone." }, { status: 404 });
  }
  const members = await listMembers(group.id);
  return NextResponse.json({
    invite: {
      token: invite.token,
      uses: invite.uses,
      max_uses: invite.max_uses,
    },
    group: {
      id: group.id,
      title: group.title,
      mode: group.mode,
      place: group.place,
      proposed_dates: group.proposed_dates,
      slug: group.slug,
    },
    member_count: members.filter((m) => m.role !== "bot").length,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { token } = await ctx.params;
  const invite = await consumeInvite(token);
  if (!invite) {
    return NextResponse.json(
      { error: "Invite invalid or exhausted." },
      { status: 410 },
    );
  }

  await addMember({
    groupId: invite.group_id,
    userId: user.id,
    displayName: user.name,
    email: user.email,
    channel: "web",
  });

  return NextResponse.json({ ok: true, group_id: invite.group_id });
}
