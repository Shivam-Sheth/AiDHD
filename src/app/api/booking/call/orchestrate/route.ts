import { NextResponse } from "next/server";
import { quoteOffer } from "@/lib/booking/quote";
import { createCallSession, updateCallSession, noteOnSession } from "@/lib/booking/call-session";
import { callDynamicVariables } from "@/lib/booking/call-vars";
import { firstMessage } from "@/lib/booking/call-script";
import { placeElevenAgentsOutbound } from "@/lib/integrations/voice";
import { createPravaSession } from "@/lib/integrations/prava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The whole booking call in one request:
 *
 *   Duffel re-price -> Prava mandate -> outbound call
 *
 * Returns the Prava Collect URL so the traveller can approve the mandate with a
 * passkey while the agent is still working through the airline's IVR, and the
 * session id used to approve the card release later.
 *
 * Nothing here touches card material. The agent still has to pass the human
 * approval gate before any number is released.
 */

/** Phone bookings carry a service fee; the mandate has to cover it or the card declines. */
const PHONE_BOOKING_FEE_BUFFER = 40;

/**
 * Duffel sandbox returns no available_services, and a phone booking has no
 * service objects anyway — the airline prices bags at the till. These are
 * deliberately generous: an under-scoped mandate declines mid-call, which is
 * far worse than authorising headroom that goes unused.
 */
const CHECKED_BAG_ESTIMATE = 45;
const SEAT_SELECTION_ESTIMATE = 25;

const CABINS = ["economy", "premium_economy", "business", "first"] as const;
type Cabin = (typeof CABINS)[number];

export async function POST(req: Request) {
  let body: {
    offer_id?: string;
    airline_phone?: string;
    passenger?: {
      given_name: string;
      family_name: string;
      born_on: string;
      email: string;
      phone_number: string;
    };
    user_id?: string;
    dry_run?: boolean;
    extras?: {
      cabin?: Cabin;
      checked_bags?: number;
      seat_preference?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { offer_id, airline_phone, passenger, user_id } = body;
  if (!offer_id || !airline_phone || !passenger) {
    return NextResponse.json(
      { error: "offer_id, airline_phone and passenger are required" },
      { status: 400 },
    );
  }

  // 1. Re-price — the agent must quote the airline a live number, not a stale one.
  const priced = await quoteOffer(offer_id);
  if (!priced.ok) {
    return NextResponse.json(
      { error: priced.error, stage: "quote", expired: priced.expired },
      { status: priced.expired ? 410 : 502 },
    );
  }
  const q = priced.quote;
  const seg = q.segments[0];

  // 2. Price the extras the traveller chose, then scope the mandate to cover
  //    fare + extras + phone fee. The agent escalates if the airline's real
  //    total still exceeds it.
  const cabin: Cabin = body.extras?.cabin && CABINS.includes(body.extras.cabin)
    ? body.extras.cabin
    : "economy";
  const bags = Math.max(0, Math.min(5, Math.floor(body.extras?.checked_bags ?? 0)));
  const seatPref = body.extras?.seat_preference?.trim() || null;

  const extrasCost =
    bags * CHECKED_BAG_ESTIMATE + (seatPref ? SEAT_SELECTION_ESTIMATE : 0);

  const mandateAmount = Number(q.amount) + extrasCost + PHONE_BOOKING_FEE_BUFFER;
  const prava = await createPravaSession({
    user_id: user_id || passenger.email,
    user_email: passenger.email,
    merchant: q.owner || "Airline",
    amount: mandateAmount,
    currency: q.currency,
    category: "flight",
    merchant_url: "https://ai-dhd.vercel.app",
  });

  const session = createCallSession({
    flight: {
      carrier: q.owner,
      flight_number: seg?.flight_number ?? "",
      origin: seg?.origin ?? "",
      destination: seg?.destination ?? "",
      departing_at: seg?.departing_at ?? "",
      amount: q.amount,
      currency: q.currency,
    },
    passenger,
    airline_phone,
    prava_session_id: prava.session_id,
    extras: {
      cabin,
      checked_bags: bags,
      seat_preference: seatPref,
      estimated_extras_cost: extrasCost.toFixed(2),
    },
  });

  // Lets you rehearse the whole chain without ringing anyone.
  if (body.dry_run) {
    noteOnSession(session.id, "dry run — no call placed");
    return NextResponse.json({
      ok: true,
      dry_run: true,
      session_id: session.id,
      quote: q,
      mandate: {
        prava_session_id: prava.session_id,
        amount: mandateAmount.toFixed(2),
        currency: q.currency,
        approve_url: prava.iframe_url,
        breakdown: {
          base_fare: q.amount,
          extras: extrasCost.toFixed(2),
          phone_booking_buffer: PHONE_BOOKING_FEE_BUFFER.toFixed(2),
        },
      },
      extras: session.extras,
      would_say: firstMessage(session),
    });
  }

  // 3. Dial.
  const placed = await placeElevenAgentsOutbound({
    to: airline_phone,
    first_message: firstMessage(session),
    agent_id: process.env.ELEVENLABS_BOOKING_AGENT_ID,
    dynamic_variables: callDynamicVariables(session),
  });

  if (!placed.ok) {
    updateCallSession(session.id, { stage: "failed", failure_reason: placed.detail });
    return NextResponse.json(
      { error: placed.detail, stage: "dial", session_id: session.id },
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
    quote: q,
    mandate: {
      prava_session_id: prava.session_id,
      amount: mandateAmount.toFixed(2),
      currency: q.currency,
      approve_url: prava.iframe_url,
      breakdown: {
        base_fare: q.amount,
        extras: extrasCost.toFixed(2),
        phone_booking_buffer: PHONE_BOOKING_FEE_BUFFER.toFixed(2),
      },
    },
    extras: session.extras,
    next: [
      "Approve the Prava mandate with a passkey at mandate.approve_url.",
      `Approve card release: POST /api/booking/call/${session.id} {"action":"approve","approver":"<name>"}`,
      `Watch progress: GET /api/booking/call/${session.id}`,
    ],
  });
}
