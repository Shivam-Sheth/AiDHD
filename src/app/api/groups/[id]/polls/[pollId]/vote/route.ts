import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { getPoll, votePoll } from "@/lib/groups/polls";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; pollId: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id, pollId } = await ctx.params;
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: { option_index?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const poll = await getPoll(pollId);
  if (!poll || poll.group_id !== id) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }
  if (poll.status !== "open") {
    return NextResponse.json({ error: "Poll is closed." }, { status: 400 });
  }
  const idx = Number(body.option_index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= poll.options.length) {
    return NextResponse.json(
      { error: "option_index out of range" },
      { status: 400 },
    );
  }

  const updated = await votePoll({
    pollId,
    groupId: id,
    userId: user.id,
    userName: user.name,
    optionIndex: idx,
  });
  return NextResponse.json({ ok: true, poll: updated });
}
