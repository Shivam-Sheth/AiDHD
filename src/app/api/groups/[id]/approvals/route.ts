import { NextResponse } from "next/server";
import { listPendingApprovals } from "@/lib/groups/approvals";
import { resolveGroupUser } from "@/lib/groups/auth";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pending agent-action approvals for this group. */
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
  const approvals = await listPendingApprovals({ groupId: id });
  return NextResponse.json({ approvals });
}
