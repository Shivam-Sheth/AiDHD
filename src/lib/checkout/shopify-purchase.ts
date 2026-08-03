/**
 * The Prava → Shopify spend pipeline, shared by the HTTP route
 * (app/api/checkout/shopify-execute) and the chat agents (group chat,
 * iMessage, SMS) so there is exactly ONE place where one-time card
 * credentials are handled.
 *
 *   1. build a Shopify cart for the chosen variant -> hosted checkoutUrl
 *   2. poll Prava for the one-time card
 *   3. spend it against that checkoutUrl via headless-browser automation
 *   4. report the real outcome back to Prava, whether step 3 succeeded,
 *      failed, or threw
 *
 * Never reports success without Shopify actually confirming an order, and
 * never returns or logs the card token/CVV — see the boundary comment below.
 */

import { reportPaymentStatus } from "@/lib/integrations/prava";
import { createShopifyCart } from "@/lib/integrations/shopify";
import { pollForCompletedPayment } from "./poll-payment-result";
import { runShopifyCheckout } from "./browser-harness";
import { logInfo } from "./debug-log";

export type ShopifyPurchaseInput = {
  session_id: string;
  merchant: string;
  amount: number;
  variant_id: string;
  email: string;
  cardholder_name?: string;
  /** How long to wait for the buyer to finish the Prava passkey. */
  poll_timeout_ms?: number;
};

export type ShopifyPurchaseResult =
  | {
      ok: true;
      confirmation_id: string;
      summary: string;
      token_ref: string;
      final_url: string;
    }
  | {
      ok: false;
      error_code:
        | "cart_failed"
        | "payment_not_ready"
        | "incomplete_credentials"
        | "shopify_checkout_failed"
        | "checkout_exception";
      error: string;
      /** True when the buyer simply hasn't finished the passkey yet — retryable. */
      retryable?: boolean;
    };

export async function executeShopifyPurchase(
  input: ShopifyPurchaseInput,
): Promise<ShopifyPurchaseResult> {
  const { session_id, merchant, amount, variant_id, email } = input;
  logInfo("shopify execute", "starting purchase", { session_id, merchant, amount, variant_id });

  // 1. BUILD THE CART -----------------------------------------------------
  const cart = await createShopifyCart({ variant_id, email });
  if (!cart.ok) {
    await reportPaymentStatus(session_id, "DECLINED").catch(() => {});
    return {
      ok: false,
      error_code: "cart_failed",
      error: `Could not create Shopify cart: ${cart.error}`,
    };
  }
  logInfo("shopify execute", "cart created", { cart_id: cart.cart_id, mode: cart.mode });

  // 2. POLL FOR CREDENTIALS ------------------------------------------------
  const polled = await pollForCompletedPayment(session_id, {
    ...(input.poll_timeout_ms ? { timeoutMs: input.poll_timeout_ms } : {}),
  });
  if (!polled.ok) {
    // A timeout means the buyer is still at the passkey — do NOT decline the
    // session, or retrying becomes impossible. Only a real decline is final.
    if (polled.reason === "timeout") {
      return {
        ok: false,
        error_code: "payment_not_ready",
        error: `Still waiting on the passkey (last status: ${polled.last_status})`,
        retryable: true,
      };
    }
    await reportPaymentStatus(session_id, "DECLINED").catch(() => {});
    return {
      ok: false,
      error_code: "payment_not_ready",
      error: `Payment declined (last status: ${polled.last_status})`,
    };
  }

  const { token, dynamic_cvv, expiry_month, expiry_year, txn_ref_id } = polled.result;
  if (!token || !dynamic_cvv || !expiry_month || !expiry_year) {
    await reportPaymentStatus(session_id, "DECLINED", txn_ref_id).catch(() => {});
    return {
      ok: false,
      error_code: "incomplete_credentials",
      error: "Payment completed but credentials were incomplete",
    };
  }
  // Last 4 digits only — same redaction pattern as debug-log.ts.
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
  let outcome:
    | { ok: true; confirmation_text: string; final_url: string }
    | { ok: false; error_code: "shopify_checkout_failed" | "checkout_exception"; error_message: string } = {
    ok: false,
    error_code: "checkout_exception",
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
        cardholder_name: input.cardholder_name || email,
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
    await reportPaymentStatus(session_id, outcome.ok ? "APPROVED" : "DECLINED", txn_ref_id).catch(
      () => {},
    );
  }
  // --- END CREDENTIAL-HANDLING BOUNDARY ---
  logInfo("shopify execute", "left credential-handling boundary", { session_id, ok: outcome.ok });

  if (!outcome.ok) {
    console.error("[shopify execute]", session_id, outcome.error_code, outcome.error_message);
    return { ok: false, error_code: outcome.error_code, error: outcome.error_message };
  }

  const confirmation_id = `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  const summary = `Prava session ${session_id} → one-time card ${tokenRef} → Shopify order at ${outcome.final_url} for $${Number(amount).toFixed(2)} at ${merchant}. Confirmation ${confirmation_id}.`;
  logInfo("shopify execute", "success", { session_id, confirmation_id, final_url: outcome.final_url });

  return { ok: true, confirmation_id, summary, token_ref: tokenRef, final_url: outcome.final_url };
}
