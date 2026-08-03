import { NextResponse } from "next/server";
import {
  getCallSession,
  getCallSessionByConversation,
  noteOnSession,
  updateCallSession,
} from "@/lib/booking/call-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fixed-URL endpoint for the voice agent's non-payment tools.
 *
 * Everything is carried in the body so the ElevenLabs tool config needs no
 * variable interpolation in the URL — that is the part most likely to silently
 * break mid-call, and a broken tool URL during a live airline call is
 * expensive.
 */
export async function POST(req: Request) {
  let body: {
    session_id?: string;
    conversation_id?: string;
    action?: "confirm" | "fail" | "note";
    confirmation_number?: string;
    reason?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Platform-supplied conversation id is trusted over the model-supplied id.
  const session =
    (body.conversation_id ? getCallSessionByConversation(body.conversation_id) : null) ??
    (body.session_id ? getCallSession(body.session_id) : null);

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        instruction:
          "That booking reference was not recognised. Do not retry payment. Apologise and end the call politely.",
      },
      { status: 404 },
    );
  }

  switch (body.action) {
    case "confirm": {
      const conf = body.confirmation_number?.trim();
      if (!conf) {
        return NextResponse.json({
          ok: false,
          instruction: "Ask the airline agent to repeat the booking reference, then call this again.",
        });
      }
      updateCallSession(session.id, { stage: "confirmed", confirmation_number: conf });
      noteOnSession(session.id, `confirmed ${conf}`);
      return NextResponse.json({
        ok: true,
        instruction: `Booking ${conf} recorded. Thank the agent and end the call.`,
      });
    }

    case "fail": {
      updateCallSession(session.id, {
        stage: "failed",
        failure_reason: body.reason || "unspecified",
      });
      noteOnSession(session.id, `failed: ${body.reason || "unspecified"}`);
      return NextResponse.json({
        ok: true,
        instruction:
          "Recorded. Do not retry the payment. Thank the agent and end the call politely.",
      });
    }

    case "note": {
      if (body.note) noteOnSession(session.id, body.note);
      return NextResponse.json({
        ok: true,
        instruction:
          "Noted — a human has been alerted. Tell the agent you need a moment to confirm, and wait.",
      });
    }

    default:
      return NextResponse.json(
        { ok: false, instruction: "Unknown action." },
        { status: 400 },
      );
  }
}
