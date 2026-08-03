import { NextResponse } from "next/server";
import { createCallSession } from "@/lib/booking/call-session";
import { firstMessage, systemPrompt } from "@/lib/booking/call-script";
import { BOOKING_DYNAMIC_VAR_KEYS } from "@/lib/booking/call-vars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a sample booking prompt for inspection.
 *
 * Preferred setup: POST /api/booking/call/sync — that pushes a placeholder-free
 * base prompt and enables first_message + system prompt overrides. Dial routes
 * then inject the real details per call. Manual paste is only a fallback.
 */
export async function GET() {
  const sample = createCallSession({
    flight: {
      carrier: "United",
      flight_number: "UA123",
      origin: "ORD",
      destination: "JFK",
      departing_at: "2026-08-14T08:00:00-05:00",
      amount: "240.00",
      currency: "USD",
    },
    passenger: {
      given_name: "Alex",
      family_name: "Rivera",
      born_on: "1994-03-12",
      email: "alex@example.com",
      phone_number: "+15551234567",
    },
    airline_phone: "+18002416522",
  });

  return NextResponse.json({
    ok: true,
    system_prompt_example: systemPrompt(sample),
    first_message_example: firstMessage(sample),
    dynamic_variable_keys: BOOKING_DYNAMIC_VAR_KEYS,
    setup: [
      "1. Create a dedicated booking agent (NOT the concierge). Set ELEVENLABS_BOOKING_AGENT_ID.",
      "2. curl -X POST /api/booking/call/sync  — enables first_message + prompt overrides, clears hotel workflow.",
      "3. Dial via /api/booking/call/start|orchestrate|reserve — each call injects a fully baked prompt.",
      "Do NOT paste a prompt full of {{placeholders}} into the dashboard. Missing keys hang up on answer (Twilio 31921).",
    ],
  });
}
