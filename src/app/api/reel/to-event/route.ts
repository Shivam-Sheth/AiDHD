import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { planFromReel } from "@/lib/reel";
import {
  addFriend,
  addGroupMessage,
  getUserById,
  listFriends,
} from "@/lib/social-store";
import { getEvent, listEvents, upsertEvent } from "@/lib/store";
import type { Event, EventType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Instagram/TikTok reel → group trip Event + chat seed message.
 * Plans the reel when `plan` is true (default).
 */
export async function POST(req: Request) {
  let body: {
    url?: string;
    organizer_id?: string;
    invitee_ids?: string[];
    friend_ids?: string[];
    title?: string;
    party_size?: number;
    selected_date?: string;
    budget_cap?: number;
    origin_city?: string;
    plan?: boolean;
    transcript?: string;
    caption?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url?.trim()) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  if (!body.organizer_id || !getUserById(body.organizer_id)) {
    return NextResponse.json(
      { error: "organizer_id must be a known user" },
      { status: 400 },
    );
  }

  const friendIds = body.friend_ids ?? [];
  for (const fid of friendIds) {
    try {
      addFriend(body.organizer_id, fid);
    } catch {
      /* ignore */
    }
  }

  const inviteeSet = new Set<string>([
    body.organizer_id,
    ...(body.invitee_ids ?? []),
    ...friendIds,
  ]);

  if ((body.invitee_ids?.length ?? 0) === 0 && friendIds.length === 0) {
    for (const f of listFriends(body.organizer_id)) inviteeSet.add(f.id);
  }

  const invitee_ids = [...inviteeSet];
  const reelUrl = body.url.trim();

  let plan = null as Awaited<ReturnType<typeof planFromReel>> | null;
  if (body.plan !== false) {
    try {
      plan = await planFromReel({
        url: reelUrl,
        transcript: body.transcript,
        caption: body.caption,
        party_size: body.party_size ?? invitee_ids.length,
        selected_date: body.selected_date,
        budget_cap: body.budget_cap,
        origin_city: body.origin_city,
        stage: "preview",
      });
    } catch (err) {
      plan = null;
      console.error("[reel/to-event] plan failed", err);
    }
  }

  const brief = plan?.brief;
  const type: EventType =
    brief?.mode === "outing" || brief?.mode === "local_event"
      ? "outing"
      : "trip";

  const event: Event = {
    id: randomUUID(),
    type,
    title:
      body.title?.trim() ||
      brief?.title ||
      `Reel trip · ${new Date().toLocaleDateString()}`,
    destination_or_venue: brief?.city || "TBD",
    proposed_dates: brief?.dates?.length
      ? brief.dates
      : body.selected_date
        ? [body.selected_date]
        : [],
    organizer_id: body.organizer_id,
    invitee_ids,
    status: "collecting",
    created_via: "web",
    created_at: new Date().toISOString(),
  };

  upsertEvent(event);

  addGroupMessage({
    event_id: event.id,
    user_id: body.organizer_id,
    content: `Shared a reel for this trip:\n${reelUrl}`,
    kind: "reel",
    meta: {
      reel_url: reelUrl,
      brief_title: brief?.title,
      city: brief?.city,
    },
  });

  addGroupMessage({
    event_id: event.id,
    user_id: body.organizer_id,
    content: brief
      ? `AiDHD decoded the reel: ${brief.summary}`
      : "Reel saved to the group — plan when you're ready.",
    kind: "system",
    meta: brief
      ? {
          places: brief.places,
          budget_cap: brief.budget_cap,
          mode: brief.mode,
        }
      : undefined,
  });

  return NextResponse.json(
    {
      event: getEvent(event.id) ?? event,
      plan,
      events: listEvents().filter((e) =>
        e.invitee_ids.includes(body.organizer_id!),
      ),
    },
    { status: 201 },
  );
}
