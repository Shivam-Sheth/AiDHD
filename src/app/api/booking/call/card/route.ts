import { NextResponse } from "next/server";
import {
  canReleaseCard,
  getCallSession,
  getCallSessionByConversation,
  maskPan,
  noteOnSession,
  updateCallSession,
} from "@/lib/booking/call-session";
import { getPaymentResult } from "@/lib/integrations/prava";
import { publishUi } from "@/lib/agent-tools/ui-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server tool the voice agent calls when the airline asks for payment.
 *
 * This is the only place card material exists, and it fails closed: without a
 * recorded human approval it returns an instruction to wait, never a number.
 * One release per session — a second call after release is refused, so a
 * confused agent cannot re-read the card or book twice.
 */
export async function POST(req: Request) {
  let body: { session_id?: string; conversation_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Platform-supplied conversation id wins over the model-supplied session id.
  const session =
    (body.conversation_id ? getCallSessionByConversation(body.conversation_id) : null) ??
    (body.session_id ? getCallSession(body.session_id) : null);
  if (!session) {
    return NextResponse.json({ error: "Unknown booking call" }, { status: 404 });
  }

  // Ask Prava first: the passkey approval is the gate, so we need its status
  // before deciding whether to release.
  const result = session.prava_session_id
    ? await getPaymentResult(session.prava_session_id)
    : null;

  const gate = canReleaseCard(session, result?.status);
  if (!gate.ok) {
    noteOnSession(session.id, `card requested, refused (${gate.reason})`);
    const firstAsk = session.stage !== "awaiting_approval";
    if (session.stage === "dialing" || session.stage === "in_call") {
      updateCallSession(session.id, { stage: "awaiting_approval" });
    }

    // Tell the front end the airline is asking for payment. Without this the
    // agent stalls politely forever and nobody knows to approve.
    if (gate.reason === "awaiting_mandate_approval" && firstAsk) {
      publishUi({
        session: session.id,
        conversation_id: session.conversation_id,
        tool: "get_payment_card",
        ui: {
          kind: "payment_approval_request",
          payload: {
            session_id: session.id,
            headline: `${session.flight.carrier} is asking for payment`,
            flight: session.flight,
            extras: session.extras,
            amount: session.flight.amount,
            currency: session.flight.currency,
            prava_session_id: session.prava_session_id,
            approve_url: session.prava_session_id
              ? `https://sandbox.collect.prava.space?session=${session.prava_session_id}`
              : null,
            note: "The agent is holding the line. Approve with your passkey to release the card.",
          },
        },
      });
    }
    // Shaped as agent-readable instructions — this text is spoken, not thrown.
    return NextResponse.json({
      released: false,
      reason: gate.reason,
      instruction:
        gate.reason === "awaiting_mandate_approval"
          ? "The traveller has not finished approving the payment yet. Tell the airline agent you need a moment to confirm, then ask again shortly. Do not invent a card number."
          : "Payment cannot be provided. Apologise, do not retry, and end the call politely.",
    });
  }

  if (!result) {
    return NextResponse.json(
      { released: false, reason: "no_prava_session", instruction: "No payment method is configured for this booking." },
      { status: 409 },
    );
  }

  const r = result as unknown as { card?: Record<string, string>; token?: string; dynamic_cvv?: string; expiry?: string };
  // Prava returns either a nested card object or a flat token/expiry/cvv trio.
  const card = r.card ?? (r.token
    ? { number: r.token, cvc: r.dynamic_cvv ?? "", expiry_month: (r.expiry ?? "").split("/")[0] ?? "", expiry_year: (r.expiry ?? "").split("/")[1] ?? "" }
    : undefined);

  if (!card?.number) {
    noteOnSession(session.id, "prava card not issued yet");
    return NextResponse.json({
      released: false,
      reason: "card_not_issued",
      instruction:
        "The card is not ready yet. Ask the agent for another moment, then try again.",
    });
  }

  // Mark released before returning: if anything downstream fails we would
  // rather refuse a second read than risk handing the card out twice.
  updateCallSession(session.id, {
    stage: "card_released",
    card_released_at: new Date().toISOString(),
  });
  noteOnSession(session.id, `card released ${maskPan(card.number)}`);

  return NextResponse.json({
    released: true,
    card: {
      number: card.number,
      expiry_month: card.expiry_month ?? card.exp_month,
      expiry_year: card.expiry_year ?? card.exp_year,
      cvc: card.cvc ?? card.cvv,
      name: card.name ?? `${session.passenger.given_name} ${session.passenger.family_name}`,
    },
    instruction:
      "Read these details once, clearly. Ask the agent to read back the last four digits to confirm. Do not repeat the full number afterwards.",
  });
}
