import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

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
    friend_ids?: string[];
  };
  const friendIds = body.friend_ids || [];
  if (!friendIds.length) {
    return NextResponse.json({ error: "friend_ids required" }, { status: 400 });
  }

  const added = await repo.addMembers(db, id, friendIds);
  for (const uid of added) {
    const profile = await repo.getProfile(db, uid);
    await repo.addMessage(db, {
      group_id: id,
      user_id: auth.user.id,
      content: `${profile?.name || "Friend"} joined the group.`,
      kind: "system",
    });
  }

  const members = await repo.listMembers(db, id);
  const group = await repo.getGroup(db, id);
  return NextResponse.json({ group, members, added });
}
