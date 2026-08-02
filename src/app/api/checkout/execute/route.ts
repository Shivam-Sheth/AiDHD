import { NextResponse } from "next/server";
import { reportPaymentStatus } from "@/lib/integrations/prava";
import { pollForCompletedPayment } from "@/lib/checkout/poll-payment-result";
import {
  payDuffelFlightOrder,
  type DuffelBillingAddress,
  type DuffelOrderPassenger,
} from "@/lib/checkout/duffel-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO: same gap as prava/complete/route.ts — source from the traveler
// profile once one exists; vault/traveler-store.ts has no address fields yet.
const FALLBACK_BILLING_ADDRESS: DuffelBillingAddress = {
  line1: "1 Market St",
  city: "San Francisco",
  region: "CA",
  postal_code: "94105",
  country_code: "US",
};

type ExecuteCheckoutBody = {
  session_id?: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  offer_id?: string;
  passengers?: DuffelOrderPassenger[];
  billing_address?: DuffelBillingAddress;
  cardholder_name?: string;
};

type CheckoutOutcome =
  | { ok: true; order_id: string; booking_reference: string }
  | { ok: false; error_code: string; error_message: string };

/**
 * Backend half of the checkout flow — the frontend has already created the
 * Prava session and gotten passkey/card-collect approval before this fires.
 *   1. poll Prava for the one-time card
 *   2. spend it against Duffel (3DS session + order creation)
 *   3. report the real outcome back to Prava, whether step 2 succeeded, failed,
 *      or threw
 * Never returns 200 without a real Duffel order id, and never echoes the
 * card token/CVV anywhere in this file — see the boundary comment below.
 */
export async function POST(req: Request) {
  let body: ExecuteCheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, merchant, amount, offer_id, passengers } = body;
  if (!session_id || !merchant || amount == null || !offer_id || !passengers?.length) {
    return NextResponse.json(
      { ok: false, error: "session_id, merchant, amount, offer_id, passengers required" },
      { status: 400 },
    );
  }

  // 1. POLL FOR CREDENTIALS ---------------------------------------------
  const polled = await pollForCompletedPayment(session_id);
  if (!polled.ok) {
    await reportPaymentStatus(session_id, "DECLINED").catch(() => {});
    return NextResponse.json(
      {
        ok: false,
        error: `Payment result not ready (${polled.reason}, last status: ${polled.last_status})`,
      },
      { status: 402 },
    );
  }
  const { token, dynamic_cvv, expiry_month, expiry_year } = polled.result;
  if (!token || !dynamic_cvv || !expiry_month || !expiry_year) {
    await reportPaymentStatus(session_id, "DECLINED").catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Payment completed but credentials were incomplete" },
      { status: 502 },
    );
  }

  // 2. EXECUTE CHECKOUT + 3. REPORT THE OUTCOME --------------------------
  // --- CREDENTIAL-HANDLING BOUNDARY ---
  // `token` (PAN) and `dynamic_cvv` below are the one-time card. Do not add
  // console.*, logger, or Sentry/monitoring calls inside this block, and
  // don't spread `polled.result` into anything logged/persisted/returned —
  // the card fields may only reach payDuffelFlightOrder's `card` argument
  // and then fall out of scope when this block ends.
  let outcome: CheckoutOutcome = {
    ok: false,
    error_code: "unreached",
    error_message: "Checkout step never ran",
  };
  try {
    const paid = await payDuffelFlightOrder({
      offer_id,
      amount: Number(amount),
      currency: body.currency || "USD",
      passengers,
      card: {
        number: token,
        cvc: dynamic_cvv,
        expiry_month,
        expiry_year,
        cardholder_name:
          body.cardholder_name || `${passengers[0].given_name} ${passengers[0].family_name}`,
      },
      billing_address: body.billing_address || FALLBACK_BILLING_ADDRESS,
    });
    outcome = paid.ok
      ? { ok: true, order_id: paid.order_id, booking_reference: paid.booking_reference }
      : { ok: false, error_code: "duffel_checkout_failed", error_message: paid.failure_reason };
  } catch (e) {
    // Deliberately not logging `e` verbatim: payDuffelFlightOrder never
    // throws with card data in its message, but we still avoid dumping the
    // raw error object into logs on principle.
    outcome = {
      ok: false,
      error_code: "checkout_exception",
      error_message: e instanceof Error ? e.message : "Checkout failed unexpectedly",
    };
  } finally {
    await reportPaymentStatus(session_id, outcome.ok ? "APPROVED" : "DECLINED").catch(() => {});
  }
  // --- END CREDENTIAL-HANDLING BOUNDARY ---

  if (!outcome.ok) {
    console.error("[checkout execute]", session_id, outcome.error_code);
    return NextResponse.json(
      { ok: false, error_code: outcome.error_code, error: outcome.error_message },
      { status: 402 },
    );
  }

  return NextResponse.json({
    ok: true,
    order_id: outcome.order_id,
    confirmation_id: outcome.booking_reference,
  });
}
