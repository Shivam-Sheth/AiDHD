import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { runGroupAgent } from "@/lib/group-agent/run";
import { extractReelUrl, isReelMessage } from "@/lib/reel";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

export async function GET(
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

  const messages = await repo.listMessages(db, id);
  return NextResponse.json({ messages });
}

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

  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    invoke_agent?: boolean;
  };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const content = body.content.trim();
  const reelUrl = extractReelUrl(content);
  const kind =
    reelUrl || isReelMessage(content) ? ("reel" as const) : ("text" as const);

  await repo.addMessage(db, {
    group_id: id,
    user_id: auth.user.id,
    content,
    kind,
    meta: reelUrl ? { reel_url: reelUrl } : {},
  });

  const force =
    body.invoke_agent === true ||
    /(^|\s)@?aidhd\b/i.test(content) ||
    kind === "reel";

  let agent = null as Awaited<ReturnType<typeof runGroupAgent>> | null;
  try {
    agent = await runGroupAgent({
      admin: auth.admin,
      groupId: id,
      triggerUserId: auth.user.id,
      triggerContent: content,
      force,
    });
  } catch (err) {
    console.error("[group messages] agent failed", err);
  }

  const messages = await repo.listMessages(db, id);
  const group = await repo.getGroup(db, id);
  return NextResponse.json(
    {
      messages,
      group,
      agent,
    },
    { status: 201 },
  );
}
