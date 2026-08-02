import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { createPoll, listPolls } from "@/lib/groups/polls";
import { isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return NextResponse.json({ polls: await listPolls(id) });
}

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

  let body: { question?: string; options?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const question = body.question?.trim();
  const options = (body.options || []).map((o) => o.trim()).filter(Boolean);
  if (!question || options.length < 2) {
    return NextResponse.json(
      { error: "question and at least 2 options required" },
      { status: 400 },
    );
  }

  const poll = await createPoll({
    groupId: id,
    question,
    options,
    createdBy: user.id,
    createdByName: user.name,
  });
  return NextResponse.json({ ok: true, poll });
}
