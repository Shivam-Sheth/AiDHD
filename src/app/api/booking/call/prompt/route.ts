import { NextResponse } from "next/server";
import { createCallSession } from "@/lib/booking/call-session";
import { firstMessage, systemPrompt } from "@/lib/booking/call-script";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the booking agent's system prompt with placeholder details, for
 * pasting into the ElevenLabs dashboard.
 *
 * Exists because /start needs ELEVENLABS_BOOKING_AGENT_ID, which you cannot
 * have until the agent is created — and creating it requires this prompt.
 */
export async function GET() {
  const sample = createCallSession({
    flight: {
      carrier: "{{carrier}}",
      flight_number: "{{flight_number}}",
      origin: "{{origin}}",
      destination: "{{destination}}",
      departing_at: "{{departing_at}}",
      amount: "{{amount}}",
      currency: "{{currency}}",
    },
    passenger: {
      given_name: "{{given_name}}",
      family_name: "{{family_name}}",
      born_on: "{{born_on}}",
      email: "{{email}}",
      phone_number: "{{phone_number}}",
    },
    airline_phone: "{{airline_phone}}",
  });

  return NextResponse.json({
    ok: true,
    system_prompt: systemPrompt(sample),
    first_message_example: firstMessage(sample),
    note:
      "Paste system_prompt into the agent's System Prompt. Leave First Message empty — /start overrides it per call. The {{placeholders}} are filled from the real booking at call time.",
  });
}
