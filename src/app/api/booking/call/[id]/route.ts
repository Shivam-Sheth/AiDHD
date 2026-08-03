import { NextResponse } from "next/server";
import {
  approveCardRelease,
  getCallSession,
  noteOnSession,
  updateCallSession,
} from "@/lib/booking/call-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll a booking call. Never returns card material — only the stage. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = getCallSession(id);
  if (!s) return NextResponse.json({ error: "Unknown booking call" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    session_id: s.id,
    stage: s.stage,
    flight: s.flight,
    passenger: { given_name: s.passenger.given_name, family_name: s.passenger.family_name },
    approved_at: s.approved_at,
    card_released_at: s.card_released_at,
    confirmation_number: s.confirmation_number,
    failure_reason: s.failure_reason,
    notes: s.transcript_notes.slice(-20),
  });
}

/**
 * Human actions on a live call.
 *
 * `approve` is the gate the card tool checks — this is the only way card
 * material is ever released, and it must be a deliberate human action.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: {
    action?: "approve" | "confirm" | "fail" | "note";
    approver?: string;
    confirmation_number?: string;
    reason?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const s = getCallSession(id);
  if (!s) return NextResponse.json({ error: "Unknown booking call" }, { status: 404 });

  switch (body.action) {
    case "approve": {
      const approver = body.approver?.trim();
      if (!approver) {
        return NextResponse.json(
          { error: "approver required — approval must be attributable to a person" },
          { status: 400 },
        );
      }
      const res = approveCardRelease(id, approver);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
      noteOnSession(id, `payment approved by ${approver}`);
      return NextResponse.json({ ok: true, stage: res.session.stage });
    }

    case "confirm": {
      const conf = body.confirmation_number?.trim();
      if (!conf) return NextResponse.json({ error: "confirmation_number required" }, { status: 400 });
      updateCallSession(id, { stage: "confirmed", confirmation_number: conf });
      noteOnSession(id, `confirmed ${conf}`);
      return NextResponse.json({ ok: true, stage: "confirmed", confirmation_number: conf });
    }

    case "fail": {
      updateCallSession(id, { stage: "failed", failure_reason: body.reason || "unspecified" });
      noteOnSession(id, `failed: ${body.reason || "unspecified"}`);
      return NextResponse.json({ ok: true, stage: "failed" });
    }

    case "note": {
      if (body.note) noteOnSession(id, body.note);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "action must be approve|confirm|fail|note" }, { status: 400 });
  }
}
