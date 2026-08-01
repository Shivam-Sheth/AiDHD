import { NextResponse } from "next/server";
import {
  addFriend,
  createUser,
  findUserByHandleOrName,
  getUserById,
  listFriendships,
  listFriends,
} from "@/lib/social-store";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (!getUserById(userId)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    friends: listFriends(userId),
    friendships: listFriendships(userId),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    friend_id?: string;
    query?: string;
    name?: string;
    create_if_missing?: boolean;
  };

  if (!body.user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (!getUserById(body.user_id)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let friendId = body.friend_id;
  if (!friendId && body.query) {
    const found = findUserByHandleOrName(body.query);
    if (found) friendId = found.id;
    else if (body.create_if_missing !== false) {
      const created = createUser({
        name: body.name?.trim() || body.query.trim().replace(/^@/, ""),
        handle: body.query.trim().replace(/^@/, ""),
      });
      friendId = created.id;
    }
  }

  if (!friendId) {
    return NextResponse.json(
      { error: "friend_id or query required" },
      { status: 400 },
    );
  }

  try {
    const friendship = addFriend(body.user_id, friendId);
    return NextResponse.json(
      {
        friendship,
        friend: getUserById(friendId),
        friends: listFriends(body.user_id),
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add friend" },
      { status: 400 },
    );
  }
}
