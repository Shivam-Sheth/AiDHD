import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
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

  const group = await repo.getGroup(db, id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const members = await repo.listMembers(db, id);
  const messages = await repo.listMessages(db, id);
  return NextResponse.json({ group, members, messages });
}
