import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { getGroup, isMember, setSpoc } from "@/lib/groups/store";

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
  if (!(await getGroup(id)) || !(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const target = body.user_id?.trim() || user.id;
  const group = await setSpoc(id, target);
  if (!group) {
    return NextResponse.json({ error: "Could not set SPOC" }, { status: 400 });
  }
  return NextResponse.json({ group });
}
