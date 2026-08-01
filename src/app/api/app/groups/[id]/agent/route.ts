import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { runGroupAgent } from "@/lib/group-agent/run";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

/** Explicitly poke the in-group AI (Meta-AI style). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const { id } = await ctx.params;
  const db = auth.admin;

  if (!(await repo.assertMember(db, id, auth.user.id))) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt =
    body.prompt?.trim() ||
    "@AiDHD catch up on this chat and tell us the best next step for the trip.";

  await repo.addMessage(db, {
    group_id: id,
    user_id: auth.user.id,
    content: prompt,
    kind: "text",
    meta: { explicit_agent: true },
  });

  const agent = await runGroupAgent({
    admin: auth.admin,
    groupId: id,
    triggerUserId: auth.user.id,
    triggerContent: prompt,
    force: true,
  });

  const messages = await repo.listMessages(db, id);
  const group = await repo.getGroup(db, id);
  return NextResponse.json({ agent, messages, group });
}
