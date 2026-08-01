import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/demo-users";
import { addFriend, addGroupMessage, getUserById } from "@/lib/social-store";
import { listEvents, upsertEvent } from "@/lib/store";
import type { Channel, EventType } from "@/lib/types";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");
  const events = listEvents();
  if (!userId) return NextResponse.json({ events });
  return NextResponse.json({
    events: events.filter(
      (e) => e.organizer_id === userId || e.invitee_ids.includes(userId),
    ),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type?: EventType;
    title?: string;
    destination_or_venue?: string;
    proposed_dates?: string[];
    created_via?: Channel;
    organizer_id?: string;
    invitee_ids?: string[];
    friend_ids?: string[];
  };

  const organizer_id = body.organizer_id ?? DEMO_USERS[0].id;
  if (!getUserById(organizer_id) && !DEMO_USERS.some((u) => u.id === organizer_id)) {
    return NextResponse.json({ error: "organizer not found" }, { status: 400 });
  }

  const friendIds = body.friend_ids ?? [];
  for (const fid of friendIds) {
    try {
      addFriend(organizer_id, fid);
    } catch {
      /* ignore */
    }
  }

  const invitee_ids = [
    ...new Set([
      organizer_id,
      ...(body.invitee_ids?.length
        ? body.invitee_ids
        : body.friend_ids?.length
          ? [organizer_id, ...friendIds]
          : DEMO_USERS.map((u) => u.id)),
    ]),
  ];

  const event = {
    id: randomUUID(),
    type: body.type ?? "outing",
    title: body.title ?? "Untitled outing",
    destination_or_venue: body.destination_or_venue ?? "TBD",
    proposed_dates: body.proposed_dates ?? [],
    organizer_id,
    invitee_ids,
    status: "collecting" as const,
    created_via: body.created_via ?? "web",
    created_at: new Date().toISOString(),
  };
  upsertEvent(event);

  addGroupMessage({
    event_id: event.id,
    user_id: organizer_id,
    content: `Created group “${event.title}”. Invite friends, chat, split costs, or paste an Instagram reel.`,
    kind: "system",
  });

  return NextResponse.json({ event }, { status: 201 });
}
