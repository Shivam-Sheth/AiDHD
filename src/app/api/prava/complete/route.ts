import { NextResponse } from "next/server";
import { getPaymentResult, reportPaymentStatus } from "@/lib/integrations/prava";
import { sendLinqChatMessage } from "@/lib/integrations/linq";
import { hasDuffel } from "@/lib/integrations/config";
import {
  payDuffelFlightOrder,
  type DuffelBillingAddress,
  type DuffelOrderPassenger,
} from "@/lib/checkout/duffel-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO: source from the organizer's traveler profile once one exists —
// vault/traveler-store.ts's TravelerProfile has no address fields today.
const FALLBACK_BILLING_ADDRESS: DuffelBillingAddress = {
  line1: "1 Market St",
  city: "San Francisco",
  region: "CA",
  postal_code: "94105",
  country_code: "US",
};

/**
 * Called right after @prava-sdk/core's collectPAN() succeeds in the browser.
 * Real flow: GET payment-result (poll briefly — it can read "awaiting_result"
 * for a moment) → POST report-status (mandatory, closes the loop with Prava).
 *
 * The one-time virtual card returned here gets charged for real when the leg
 * is a flight with a Duffel offer attached (category "flight" + duffel_offer_id
 * + passengers, see payDuffelFlightOrder) — Duffel has no checkout page to
 * automate, so this pays via their REST API directly, not browser automation.
 * Everything else (dining/tickets/hotels — no merchant payment API wired yet)
 * still only reports the Prava enrollment succeeding; see browser-harness.ts
 * for the intended path once a merchant needs UI-driven checkout.
 */
export async function POST(req: Request) {
  let body: {
    session_id?: string;
    merchant?: string;
    amount?: number;
    currency?: string;
    category?: string;
    linq_chat_id?: string;
    duffel_offer_id?: string;
    passengers?: DuffelOrderPassenger[];
    billing_address?: DuffelBillingAddress;
    cardholder_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.session_id || !body.merchant || body.amount == null) {
    return NextResponse.json(
      { error: "session_id, merchant, amount required" },
      { status: 400 },
    );
  }

  const PENDING_STATUSES = new Set(["pending", "processing", "awaiting_result"]);
  let result = await getPaymentResult(body.session_id);
  for (let i = 0; i < 5 && PENDING_STATUSES.has(result.status); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await getPaymentResult(body.session_id);
  }

  if (result.status !== "completed") {
    await reportPaymentStatus(body.session_id, "DECLINED");
    return NextResponse.json(
      { ok: false, error: `Payment not completed (status: ${result.status})` },
      { status: 402 },
    );
  }

  // Only flight legs with an offer + passengers attached actually get
  // charged against a real merchant right now — everything else falls back
  // to reporting the Prava enrollment as the outcome, same as before.
  const canPayDuffel =
    result.mode === "live" &&
    hasDuffel() &&
    body.category === "flight" &&
    Boolean(body.duffel_offer_id) &&
    Boolean(body.passengers?.length) &&
    Boolean(result.token && result.dynamic_cvv && result.expiry_month && result.expiry_year);

  let duffelOrder: { order_id: string; booking_reference: string } | null = null;
  let duffelFailure: string | null = null;

  if (canPayDuffel) {
    const passengers = body.passengers!;
    const paid = await payDuffelFlightOrder({
      offer_id: body.duffel_offer_id!,
      amount: Number(body.amount),
      currency: body.currency || "USD",
      passengers,
      card: {
        number: result.token!,
        cvc: result.dynamic_cvv!,
        expiry_month: result.expiry_month!,
        expiry_year: result.expiry_year!,
        cardholder_name:
          body.cardholder_name || `${passengers[0].given_name} ${passengers[0].family_name}`,
      },
      billing_address: body.billing_address || FALLBACK_BILLING_ADDRESS,
    });
    if (paid.ok) {
      duffelOrder = paid;
    } else {
      duffelFailure = paid.failure_reason;
    }
  }

  // Report the REAL outcome to Prava: if we attempted a merchant charge, its
  // result decides APPROVED/DECLINED; otherwise enrollment succeeding is the
  // only signal we have (unchanged from before Duffel wiring).
  const merchantChargeOk = !canPayDuffel || duffelOrder != null;
  await reportPaymentStatus(body.session_id, merchantChargeOk ? "APPROVED" : "DECLINED");

  if (canPayDuffel && !duffelOrder) {
    return NextResponse.json(
      { ok: false, error: `Duffel order failed: ${duffelFailure}` },
      { status: 402 },
    );
  }

  const confirmation_id = duffelOrder?.booking_reference || `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  const tokenRef = result.token ? `•••• ${result.token.slice(-4)}` : "mock";
  const summary = duffelOrder
    ? `Prava session ${body.session_id} → one-time card ${tokenRef} → Duffel order ${duffelOrder.order_id} for $${Number(body.amount).toFixed(2)} at ${body.merchant}. Confirmation ${confirmation_id}.`
    : result.mode === "live"
      ? `Prava session ${body.session_id} → one-time card ${tokenRef} for $${Number(body.amount).toFixed(2)} at ${body.merchant}. Confirmation ${confirmation_id}.`
      : `Mock checkout ${confirmation_id} for $${Number(body.amount).toFixed(2)} at ${body.merchant} (set PRAVA_SECRET_KEY + PRAVA_PUBLISHABLE_KEY for live Collect).`;

  if (body.linq_chat_id) {
    await sendLinqChatMessage({
      chat_id: body.linq_chat_id,
      text: `Booked via Prava · ${confirmation_id}\n${body.merchant} · $${Number(body.amount).toFixed(2)}`,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    confirmation_id,
    summary,
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id,
        session_id: body.session_id,
        // No separate "mandate" object in the real API — the session itself
        // is the scoping unit, so this just mirrors session_id for the UI.
        mandate_id: body.session_id,
        token_ref: tokenRef,
        merchant: body.merchant,
        amount: Number(body.amount),
        mode: result.mode,
        summary,
      },
    },
  });
}
