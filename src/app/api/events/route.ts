import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/demo-users";
import { listEvents, upsertEvent } from "@/lib/store";
import type { Channel, EventType } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ events: listEvents() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    type?: EventType;
    title?: string;
    destination_or_venue?: string;
    proposed_dates?: string[];
    created_via?: Channel;
  };

  const event = {
    id: randomUUID(),
    type: body.type ?? "outing",
    title: body.title ?? "Untitled outing",
    destination_or_venue: body.destination_or_venue ?? "TBD",
    proposed_dates: body.proposed_dates ?? [],
    organizer_id: DEMO_USERS[0].id,
    invitee_ids: DEMO_USERS.map((u) => u.id),
    status: "collecting" as const,
    created_via: body.created_via ?? "web",
    created_at: new Date().toISOString(),
  };
  upsertEvent(event);
  return NextResponse.json({ event }, { status: 201 });
}
