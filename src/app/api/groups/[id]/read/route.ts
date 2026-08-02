import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { listReads, markRead } from "@/lib/groups/chat-extras";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read receipts for the group (who has read up to when). */
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
  return NextResponse.json({ reads: await listReads(id) });
}

/** Mark the group read up to now (or a specific message). */
export async function POST(
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
  let body: { last_message_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }
  const read = await markRead({
    groupId: id,
    userId: user.id,
    lastMessageId: body.last_message_id,
  });
  return NextResponse.json({ ok: true, read });
}
