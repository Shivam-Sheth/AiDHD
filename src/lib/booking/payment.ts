/**
 * Payment rail for Duffel orders.
 *
 * Duffel accepts two payment types we care about:
 *   - `balance`: draws from the Duffel account. Sandbox has unlimited balance,
 *     live must be funded. No special entitlement.
 *   - `card`: pay with our own (Prava-issued) virtual card, via a card token
 *     from the PCI-scoped host and a 3DS session.
 *
 * The card path is gated on a Duffel account entitlement that is *separate from
 * test/live*. As of 2026-08-02 it returns 403 `unavailable_feature` on both our
 * test and live tokens, pending help@duffel.com enabling Duffel Payments.
 * Everything here is written for the card path and degrades to balance, so the
 * switch is one env var when Duffel opens it.
 */

const CARDS_HOST = "https://api.duffel.cards";
const API_HOST = "https://api.duffel.com";

export type CardEntitlement = "available" | "unavailable" | "unknown";

export type PaymentPlan =
  | { type: "card"; three_d_secure_session_id: string; amount: string; currency: string }
  | { type: "balance"; amount: string; currency: string };

export type PaymentResult =
  | { ok: true; plan: PaymentPlan }
  | { ok: false; stage: "card_token" | "three_d_secure"; entitlement: CardEntitlement; error: string };

function duffelKey(): string {
  return process.env.DUFFEL_API_KEY || "";
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${duffelKey()}`,
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Card details as issued by Prava. Never logged, never returned to the client. */
export type VirtualCard = {
  number: string;
  expiry_month: string;
  expiry_year: string;
  cvc: string;
  name: string;
  address_line_1: string;
  address_city: string;
  address_region: string;
  address_postal_code: string;
  address_country_code: string;
};

/**
 * Exchange raw card details for a Duffel card id. The PAN goes straight to
 * Duffel's PCI-scoped host and is never persisted or logged here.
 */
export async function createCardToken(
  card: VirtualCard,
): Promise<{ ok: true; card_id: string } | { ok: false; entitlement: CardEntitlement; error: string }> {
  if (!duffelKey()) {
    return { ok: false, entitlement: "unknown", error: "DUFFEL_API_KEY not set" };
  }

  const res = await fetch(`${CARDS_HOST}/payments/cards`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data: { ...card, multi_use: false } }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: Array<{ code?: string; title?: string; message?: string }>;
  };

  if (res.ok && body.data?.id) {
    return { ok: true, card_id: body.data.id };
  }

  const err = body.errors?.[0];
  // The specific signal that the account lacks Duffel Payments, as opposed to a
  // bad card or a transient failure — worth surfacing distinctly to the caller.
  const entitlement: CardEntitlement =
    res.status === 403 && err?.code === "unavailable_feature" ? "unavailable" : "unknown";

  return {
    ok: false,
    entitlement,
    error:
      entitlement === "unavailable"
        ? "Duffel Payments is not enabled on this account (403 unavailable_feature). Contact help@duffel.com to enable card payments."
        : err?.message || err?.title || `Card token failed (HTTP ${res.status})`,
  };
}

/**
 * 3DS session for the card. `secure_corporate_payment` is the exception Duffel
 * documents for corporate/virtual card flows where there is no cardholder
 * present to complete a challenge.
 */
export async function createThreeDSecureSession(input: {
  card_id: string;
  offer_id: string;
  services?: Array<{ id: string; quantity: number }>;
}): Promise<{ ok: true; session_id: string } | { ok: false; error: string }> {
  const res = await fetch(`${API_HOST}/payments/three_d_secure_sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: {
        card_id: input.card_id,
        resource_id: input.offer_id,
        services: input.services ?? [],
        exception: "secure_corporate_payment",
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; status?: string };
    errors?: Array<{ title?: string; message?: string }>;
  };

  if (res.ok && body.data?.id && body.data.status === "ready_for_payment") {
    return { ok: true, session_id: body.data.id };
  }
  if (res.ok && body.data?.status) {
    return { ok: false, error: `3DS session not ready for payment (status: ${body.data.status})` };
  }
  return {
    ok: false,
    error: body.errors?.[0]?.message || body.errors?.[0]?.title || `3DS failed (HTTP ${res.status})`,
  };
}

/**
 * Build the payment object for an order.
 *
 * With a card: tokenize -> 3DS -> card payment. Without one (or when Duffel
 * Payments is not entitled) fall back to balance, which is what makes the
 * sandbox flow runnable end to end today.
 */
export async function preparePayment(input: {
  offer_id: string;
  amount: string;
  currency: string;
  card?: VirtualCard | null;
}): Promise<PaymentResult> {
  if (!input.card) {
    return { ok: true, plan: { type: "balance", amount: input.amount, currency: input.currency } };
  }

  const token = await createCardToken(input.card);
  if (!token.ok) {
    return { ok: false, stage: "card_token", entitlement: token.entitlement, error: token.error };
  }

  const session = await createThreeDSecureSession({
    card_id: token.card_id,
    offer_id: input.offer_id,
  });
  if (!session.ok) {
    return { ok: false, stage: "three_d_secure", entitlement: "available", error: session.error };
  }

  return {
    ok: true,
    plan: {
      type: "card",
      three_d_secure_session_id: session.session_id,
      amount: input.amount,
      currency: input.currency,
    },
  };
}

/** Probe used by the health endpoint / UI to show whether the card rail is open. */
export async function cardRailStatus(): Promise<{ entitlement: CardEntitlement; detail: string }> {
  if (!duffelKey()) return { entitlement: "unknown", detail: "DUFFEL_API_KEY not set" };
  const res = await fetch(`${CARDS_HOST}/payments/cards`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data: {} }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    errors?: Array<{ code?: string }>;
  };
  if (res.status === 403 && body.errors?.[0]?.code === "unavailable_feature") {
    return { entitlement: "unavailable", detail: "Duffel Payments not enabled on this account" };
  }
  // A validation error means the endpoint is reachable and entitled — it is
  // rejecting the deliberately empty body, not the account.
  if (res.status === 422) return { entitlement: "available", detail: "Card rail entitled" };
  return { entitlement: "unknown", detail: `Unexpected HTTP ${res.status}` };
}
