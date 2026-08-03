import { NextResponse } from "next/server";
import { createCallSession, updateCallSession, noteOnSession } from "@/lib/booking/call-session";
import { callDynamicVariables } from "@/lib/booking/call-vars";
import { firstMessage, systemPrompt } from "@/lib/booking/call-script";
import { placeElevenAgentsOutbound } from "@/lib/integrations/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts an agent-placed booking call. Returns the session id the UI polls and
 * approves against. No card material is involved at this stage.
 */
export async function POST(req: Request) {
  let body: {
    airline_phone?: string;
    flight?: {
      carrier: string;
      flight_number: string;
      origin: string;
      destination: string;
      departing_at: string;
      amount: string;
      currency: string;
    };
    passenger?: {
      given_name: string;
      family_name: string;
      born_on: string;
      email: string;
      phone_number: string;
    };
    prava_session_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { airline_phone, flight, passenger, prava_session_id } = body;
  if (!airline_phone || !flight || !passenger) {
    return NextResponse.json(
      { error: "airline_phone, flight and passenger are required" },
      { status: 400 },
    );
  }

  const session = createCallSession({
    flight,
    passenger,
    airline_phone,
    prava_session_id: prava_session_id ?? null,
  });

  // Deliberately its own agent. The card tool lives only here — the concierge
  // agent talks to users, and anything it ingests could try to talk it into
  // reading card details out.
  const bookingAgentId = process.env.ELEVENLABS_BOOKING_AGENT_ID;
  if (!bookingAgentId) {
    updateCallSession(session.id, {
      stage: "failed",
      failure_reason: "ELEVENLABS_BOOKING_AGENT_ID not set",
    });
    return NextResponse.json(
      {
        error: "ELEVENLABS_BOOKING_AGENT_ID is not set.",
        session_id: session.id,
        hint: "Create a dedicated booking agent in ElevenLabs. Do not reuse the concierge agent — the card tool must not be reachable from an agent that talks to users.",
      },
      { status: 503 },
    );
  }

  const placed = await placeElevenAgentsOutbound({
    to: airline_phone,
    first_message: firstMessage(session),
    agent_id: bookingAgentId,
    // Every {{placeholder}} in the prompt, not just session_id — an undefined
    // one terminates the conversation instantly. See call-vars.ts.
    dynamic_variables: callDynamicVariables(session),
  });

  if (!placed.ok) {
    updateCallSession(session.id, { stage: "failed", failure_reason: placed.detail });
    return NextResponse.json(
      {
        error: placed.detail,
        session_id: session.id,
        hint: "Import the Twilio number into ElevenLabs and set ELEVENLABS_AGENT_PHONE_NUMBER_ID.",
      },
      { status: 503 },
    );
  }

  updateCallSession(session.id, {
    stage: "dialing",
    conversation_id: placed.conversation_id ?? null,
  });
  noteOnSession(session.id, `dialing ${airline_phone}`);

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    conversation_id: placed.conversation_id,
    stage: "dialing",
    // Handy for wiring the agent in the ElevenLabs dashboard.
    system_prompt: systemPrompt(session),
  });
}
