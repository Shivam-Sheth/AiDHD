import { NextResponse } from "next/server";
import {
  addResponse,
  ensureSeeded,
  getEvent,
  listResponses,
  resetStore,
  seedDemoEvent,
  upsertEvent,
} from "@/lib/store";

/** Hardcode 3 fixture Responses for a fast demo loop. */
export async function POST() {
  resetStore();
  const event = seedDemoEvent();

  const fixtures = [
    {
      user_id: "user_maya",
      channel: "web" as const,
      budget_cap: 150,
      preferences: {
        free_text:
          "Organizing — want something fun but not chaotic. Prefer Brooklyn, happy hour energy, vegetarian-friendly dinner.",
        structured_tags: ["brooklyn", "vegetarian", "organizer"],
      },
      availability: ["2026-08-07", "2026-08-08"],
    },
    {
      user_id: "user_jordan",
      channel: "whatsapp" as const,
      budget_cap: 100,
      preferences: {
        free_text:
          "Standing room fine, want Brooklyn not Midtown, vegetarian-friendly dinner, keep it under control budget-wise.",
        structured_tags: ["brooklyn", "standing", "vegetarian"],
      },
      availability: ["2026-08-07"],
    },
    {
      user_id: "user_sam",
      channel: "imessage" as const,
      budget_cap: 200,
      preferences: {
        free_text:
          "Want a proper sit-down dinner and good seats — fine splurging a bit. Either night works, prefer Sat if seats are better.",
        structured_tags: ["seated", "splurge", "dinner"],
      },
      availability: ["2026-08-07", "2026-08-08"],
    },
  ];

  for (const f of fixtures) {
    addResponse({
      event_id: event.id,
      user_id: f.user_id,
      channel: f.channel,
      budget_cap: f.budget_cap,
      budget_currency: "USD",
      preferences: f.preferences,
      availability: f.availability,
    });
  }

  upsertEvent({ ...getEvent(event.id)!, status: "reconciling" });
  ensureSeeded();

  return NextResponse.json({
    event: getEvent(event.id),
    responses: listResponses(event.id),
  });
}
