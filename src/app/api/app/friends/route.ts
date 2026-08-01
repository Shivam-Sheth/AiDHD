import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const db = auth.admin;
  await repo.ensureProfile(db, {
    id: auth.user.id,
    email: auth.user.email,
  });
  const friends = await repo.listFriends(db, auth.user.id);
  return NextResponse.json({ friends });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const db = auth.admin;

  await repo.ensureProfile(db, {
    id: auth.user.id,
    email: auth.user.email,
  });

  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    friend_id?: string;
  };

  let friendId = body.friend_id;
  if (!friendId && body.query?.trim()) {
    const hits = await repo.searchProfiles(db, body.query, auth.user.id);
    if (!hits[0]) {
      return NextResponse.json(
        {
          error:
            "No user found with that email, @handle, or name. They need to sign up first.",
        },
        { status: 404 },
      );
    }
    friendId = hits[0].id;
  }

  if (!friendId) {
    return NextResponse.json(
      { error: "friend_id or query required" },
      { status: 400 },
    );
  }

  try {
    const result = await repo.addFriend(db, auth.user.id, friendId);
    const friends = await repo.listFriends(db, auth.user.id);
    return NextResponse.json({ ...result, friends }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add friend" },
      { status: 400 },
    );
  }
}
