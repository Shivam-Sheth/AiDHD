import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { isMember } from "@/lib/groups/store";
import { broadcastGroupEvent } from "@/lib/realtime/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Typing indicator — relayed to the group's realtime channel. */
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
  await broadcastGroupEvent(id, "member", {
    typing: true,
    user_id: user.id,
    user_name: user.name,
  });
  return NextResponse.json({ ok: true });
}
