import { NextResponse } from "next/server";
import { decideApproval, getApproval } from "@/lib/groups/approvals";
import { resolveGroupUser } from "@/lib/groups/auth";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; approvalId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, approvalId } = await ctx.params;
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }
  const approval = await getApproval(approvalId);
  if (!approval || approval.group_id !== id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ approval });
}

/** Explicit human decision on an agent action — approve or decline. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; approvalId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, approvalId } = await ctx.params;
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: { decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const decision = body.decision === "approved" ? "approved" : "declined";

  const existing = await getApproval(approvalId);
  if (!existing || existing.group_id !== id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const approval = await decideApproval({
    approvalId,
    decision,
    decidedBy: user.id,
    decidedByName: user.name,
    origin: new URL(req.url).origin,
  });
  return NextResponse.json({ ok: true, approval });
}
