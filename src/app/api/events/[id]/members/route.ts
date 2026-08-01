import { NextResponse } from "next/server";
import { addFriend, addGroupMessage, getUserById } from "@/lib/social-store";
import { getEvent, upsertEvent } from "@/lib/store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    members: event.invitee_ids.map((uid) => getUserById(uid)).filter(Boolean),
    organizer_id: event.organizer_id,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const event = getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    friend_ids?: string[];
  };

  if (!body.user_id || !event.invitee_ids.includes(body.user_id)) {
    return NextResponse.json(
      { error: "user_id must be an existing group member" },
      { status: 403 },
    );
  }

  const friendIds = body.friend_ids ?? [];
  if (friendIds.length === 0) {
    return NextResponse.json({ error: "friend_ids required" }, { status: 400 });
  }

  const added: string[] = [];
  for (const fid of friendIds) {
    if (!getUserById(fid)) continue;
    try {
      addFriend(body.user_id, fid);
    } catch {
      /* ignore */
    }
    if (!event.invitee_ids.includes(fid)) {
      added.push(fid);
    }
  }

  if (added.length) {
    const next = {
      ...event,
      invitee_ids: [...event.invitee_ids, ...added],
    };
    upsertEvent(next);
    for (const fid of added) {
      const name = getUserById(fid)?.name ?? fid;
      addGroupMessage({
        event_id: id,
        user_id: body.user_id,
        content: `${name} joined the group.`,
        kind: "system",
      });
    }
  }

  const fresh = getEvent(id)!;
  return NextResponse.json({
    event: fresh,
    members: fresh.invitee_ids.map((uid) => getUserById(uid)).filter(Boolean),
    added,
  });
}
