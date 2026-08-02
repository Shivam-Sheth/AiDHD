import { NextResponse } from "next/server";
import { reportPaymentStatus } from "@/lib/integrations/prava";
import { createShopifyCart } from "@/lib/integrations/shopify";
import { pollForCompletedPayment } from "@/lib/checkout/poll-payment-result";
import { runShopifyCheckout } from "@/lib/checkout/browser-harness";
import { logInfo } from "@/lib/checkout/debug-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps configurable maxDuration at 60s (default compute) — a real
// headless-browser checkout run (page load + fill + submit + wait for the
// order-confirmation redirect) needs most of that. If this route times out
// in practice, that's the first thing to check (Vercel plan/Fluid Compute),
// not the automation logic.
export const maxDuration = 60;

type ExecuteShopifyCheckoutBody = {
  session_id?: string;
  merchant?: string;
  amount?: number;
  variant_id?: string;
  email?: string;
  cardholder_name?: string;
};

type CheckoutOutcome =
  | { ok: true; confirmation_text: string; final_url: string }
  | { ok: false; error_code: string; error_message: string };

/**
 * Backend half of the checkout flow for Shopify-sourced legs (see
 * agent-tools/registry.ts's search_products / create_payment category
 * "product") — the frontend has already created the Prava session and gotten
 * passkey/card-collect approval before this fires. Mirrors
 * app/api/checkout/execute/route.ts's shape (Duffel flights) but spends the
 * one-time card via runShopifyCheckout (Playwright) instead of a merchant
 * REST API, since Shopify doesn't expose one for tokenized card payment
 * anymore — see browser-harness.ts's header comment.
 *   1. build a Shopify cart for the chosen variant -> checkoutUrl
 *   2. poll Prava for the one-time card
 *   3. spend it against that checkoutUrl via headless-browser automation
 *   4. report the real outcome back to Prava, whether step 3 succeeded,
 *      failed, or threw
 * Never returns 200 without Shopify actually confirming an order, and never
 * echoes the card token/CVV anywhere in this file — see the boundary comment
 * below and in browser-harness.ts.
 */
export async function POST(req: Request) {
  let body: ExecuteShopifyCheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, merchant, amount, variant_id, email } = body;
  logInfo("shopify execute", "incoming request", { session_id, merchant, amount, variant_id });
  if (!session_id || !merchant || amount == null || !variant_id || !email) {
    return NextResponse.json(
      { ok: false, error: "session_id, merchant, amount, variant_id, email required" },
      { status: 400 },
    );
  }

  // 1. BUILD THE CART -----------------------------------------------------
  const cart = await createShopifyCart({ variant_id, email });
  if (!cart.ok) {
    await reportPaymentStatus(session_id, "DECLINED").catch(() => {});
    return NextResponse.json(
      { ok: false, error: `Could not create Shopify cart: ${cart.error}` },
      { status: 502 },
    );
  }
  logInfo("shopify execute", "cart created", { cart_id: cart.cart_id, mode: cart.mode });

  // 2. POLL FOR CREDENTIALS ------------------------------------------------
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
  const { token, dynamic_cvv, expiry_month, expiry_year, txn_ref_id } = polled.result;
  if (!token || !dynamic_cvv || !expiry_month || !expiry_year) {
    await reportPaymentStatus(session_id, "DECLINED", txn_ref_id).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Payment completed but credentials were incomplete" },
      { status: 502 },
    );
  }
  // Last 4 digits only — same redaction pattern as checkout/execute/route.ts.
  const tokenRef = `•••• ${token.slice(-4)}`;

  // 3. EXECUTE CHECKOUT + 4. REPORT THE OUTCOME ----------------------------
  // --- CREDENTIAL-HANDLING BOUNDARY ---
  // `token` (PAN) and `dynamic_cvv` below are the one-time card. Do not add
  // console.*, logger, or Sentry/monitoring calls inside this block, and
  // don't spread `polled.result` into anything logged/persisted/returned —
  // the card fields may only reach runShopifyCheckout's `card` argument and
  // then fall out of scope when this block ends. (runShopifyCheckout's own
  // logInfo calls are already step-name-only, never field values.)
  logInfo("shopify execute", "entering credential-handling boundary", { session_id });
  let outcome: CheckoutOutcome = {
    ok: false,
    error_code: "unreached",
    error_message: "Checkout step never ran",
  };
  try {
    const paid = await runShopifyCheckout({
      checkout_url: cart.checkout_url,
      email,
      card: {
        number: token,
        cvc: dynamic_cvv,
        expiry_month,
        expiry_year,
        cardholder_name: body.cardholder_name || email,
      },
    });
    outcome = paid.ok
      ? { ok: true, confirmation_text: paid.confirmation_text, final_url: paid.final_url }
      : { ok: false, error_code: "shopify_checkout_failed", error_message: paid.failure_reason };
  } catch (e) {
    outcome = {
      ok: false,
      error_code: "checkout_exception",
      error_message: e instanceof Error ? e.message : "Checkout failed unexpectedly",
    };
  } finally {
    await reportPaymentStatus(session_id, outcome.ok ? "APPROVED" : "DECLINED", txn_ref_id).catch(() => {});
  }
  // --- END CREDENTIAL-HANDLING BOUNDARY ---
  logInfo("shopify execute", "left credential-handling boundary", { session_id, ok: outcome.ok });

  if (!outcome.ok) {
    console.error("[shopify execute]", session_id, outcome.error_code, outcome.error_message);
    return NextResponse.json(
      { ok: false, error_code: outcome.error_code, error: outcome.error_message },
      { status: 402 },
    );
  }

  const confirmation_id = `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  const summary = `Prava session ${session_id} → one-time card ${tokenRef} → Shopify order at ${outcome.final_url} for $${Number(amount).toFixed(2)} at ${merchant}. Confirmation ${confirmation_id}.`;
  logInfo("shopify execute", "success", { session_id, confirmation_id, final_url: outcome.final_url });

  return NextResponse.json({
    ok: true,
    confirmation_id,
    summary,
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id,
        session_id,
        mandate_id: session_id,
        token_ref: tokenRef,
        merchant,
        amount: Number(amount),
        mode: "live",
        summary,
        shopify_order_url: outcome.final_url,
      },
    },
  });
}
