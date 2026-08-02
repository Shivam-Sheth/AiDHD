import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { createInvite, getGroup, isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const invite = await createInvite(id, user.id);
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    invite,
    invite_url: `${origin}/invite/${invite.token}`,
  });
}
