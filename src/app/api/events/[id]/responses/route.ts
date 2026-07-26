import { NextResponse } from "next/server";
import {
  addResponse,
  getEvent,
  listResponses,
  upsertEvent,
} from "@/lib/store";
import type { Channel } from "@/lib/types";

/**
 * Ingestion API — all channels (web / WhatsApp / iMessage) POST the same Response schema.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!getEvent(id)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ responses: listResponses(id) });
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

  const body = (await req.json()) as {
    user_id: string;
    channel: Channel;
    budget_cap: number;
    budget_currency?: string;
    preferences: { free_text: string; structured_tags?: string[] };
    availability: string[];
  };

  if (!body.user_id || body.budget_cap == null || !body.preferences?.free_text) {
    return NextResponse.json(
      { error: "user_id, budget_cap, preferences.free_text required" },
      { status: 400 },
    );
  }

  const response = addResponse({
    event_id: id,
    user_id: body.user_id,
    channel: body.channel ?? "web",
    budget_cap: Number(body.budget_cap),
    budget_currency: body.budget_currency ?? "USD",
    preferences: {
      free_text: body.preferences.free_text,
      structured_tags: body.preferences.structured_tags ?? [],
    },
    availability: body.availability ?? [],
  });

  const responses = listResponses(id);
  if (responses.length >= event.invitee_ids.length && event.status === "collecting") {
    upsertEvent({ ...event, status: "reconciling" });
  }

  return NextResponse.json({ response }, { status: 201 });
}
