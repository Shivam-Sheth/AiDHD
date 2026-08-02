import { hasDuffel } from "../integrations/config";
import { logRequest, logResponse, redactCard } from "./debug-log";

/**
 * Pays a Duffel flight order with a raw card (e.g. Prava's one-time virtual
 * card) entirely server-to-server — no browser, no @duffel/components widget.
 * That widget is Duffel's recommended path when a *human* is present to type
 * their own card in; here the "cardholder" is a merchant-locked virtual card
 * minted by Prava, so there's nothing for a person to fill in.
 *
 * Card tokenization deliberately hits a different host (api.duffel.cards,
 * not api.duffel.com) per Duffel's docs — that's how they keep raw PAN/CVV
 * out of PCI scope on the main API. Card payments must be enabled on your
 * Duffel account by their support team before any of this returns anything
 * but a permissions error.
 */

const CARDS_HOST = "https://api.duffel.cards";
const API_HOST = "https://api.duffel.com";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
    "Content-Type": "application/json",
    "Duffel-Version": "v2",
    Accept: "application/json",
  };
}

export type DuffelBillingAddress = {
  line1: string;
  city: string;
  region: string;
  postal_code: string;
  /** ISO 3166-1 alpha-2, e.g. "US" */
  country_code: string;
};

export type DuffelCard = {
  number: string;
  cvc: string;
  expiry_month: string;
  expiry_year: string;
  cardholder_name: string;
};

export type DuffelOrderPassenger = {
  /** Must match a passenger id from the original offer request. */
  id: string;
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  /** YYYY-MM-DD */
  born_on: string;
  gender: "m" | "f";
  title: "mr" | "ms" | "mrs" | "miss";
};

type DuffelErrorBody = { errors?: Array<{ message?: string }> };

export async function createDuffelCard(
  card: DuffelCard,
  billing_address: DuffelBillingAddress,
): Promise<{ ok: true; card_id: string } | { ok: false; error: string }> {
  const url = `${CARDS_HOST}/payments/cards`;
  const reqBody = {
    data: {
      number: card.number,
      cvc: card.cvc,
      expiry_month: card.expiry_month,
      expiry_year: card.expiry_year,
      name: card.cardholder_name,
      address_line_1: billing_address.line1,
      address_city: billing_address.city,
      address_region: billing_address.region,
      address_postal_code: billing_address.postal_code,
      address_country_code: billing_address.country_code,
      multi_use: false,
    },
  };
  // Logged redacted — number/cvc never appear in full; see debug-log.ts.
  logRequest("duffel", "POST", url, { data: redactCard(reqBody.data) });
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(reqBody),
  });
  const json = (await res.json().catch(() => null)) as { data?: { id?: string } } & DuffelErrorBody | null;
  logResponse("duffel", "POST", url, res.status, json);
  if (!res.ok || !json?.data?.id) {
    return { ok: false, error: json?.errors?.[0]?.message || `Duffel card creation failed (${res.status})` };
  }
  return { ok: true, card_id: json.data.id };
}

/**
 * `resource_id` is the offer (or order) being paid for. `secure_corporate_payment`
 * requests the frictionless path — no cardholder present to complete a real
 * 3DS challenge. Duffel may still come back with a challenge status for some
 * issuers; that case isn't handled here (it needs a real browser redirect).
 */
export async function createThreeDSecureSession(
  card_id: string,
  resource_id: string,
): Promise<{ ok: true; session_id: string; status: string } | { ok: false; error: string }> {
  const url = `${API_HOST}/payments/three_d_secure_sessions`;
  const reqBody = {
    data: {
      card_id,
      resource_id,
      cardholder_present: false,
      exception: "secure_corporate_payment",
    },
  };
  logRequest("duffel", "POST", url, reqBody);
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(reqBody),
  });
  const json = (await res.json().catch(() => null)) as
    | ({ data?: { id?: string; status?: string } } & DuffelErrorBody)
    | null;
  logResponse("duffel", "POST", url, res.status, json);
  if (!res.ok || !json?.data?.id) {
    return { ok: false, error: json?.errors?.[0]?.message || `3DS session failed (${res.status})` };
  }
  return { ok: true, session_id: json.data.id, status: json.data.status || "unknown" };
}

export type DuffelPaymentResult =
  | { ok: true; order_id: string; booking_reference: string }
  | { ok: false; failure_reason: string };

/**
 * Tokenize card → authorize (3DS) → create + pay for the order, in one shot
 * (Duffel's "instant" order type charges at creation time; no separate hold).
 */
export async function payDuffelFlightOrder(input: {
  offer_id: string;
  amount: number;
  currency: string;
  passengers: DuffelOrderPassenger[];
  card: DuffelCard;
  billing_address: DuffelBillingAddress;
}): Promise<DuffelPaymentResult> {
  if (!hasDuffel()) {
    return { ok: false, failure_reason: "DUFFEL_API_KEY not configured" };
  }

  const card = await createDuffelCard(input.card, input.billing_address);
  if (!card.ok) return { ok: false, failure_reason: card.error };

  const session = await createThreeDSecureSession(card.card_id, input.offer_id);
  if (!session.ok) return { ok: false, failure_reason: session.error };
  if (session.status !== "ready_for_payment") {
    return {
      ok: false,
      failure_reason: `3DS session not ready for payment (status: ${session.status}) — challenge flow isn't implemented here`,
    };
  }

  const ordersUrl = `${API_HOST}/air/orders`;
  const ordersReqBody = {
    data: {
      type: "instant",
      selected_offers: [input.offer_id],
      passengers: input.passengers,
      payments: [
        {
          type: "card",
          currency: input.currency,
          amount: input.amount.toFixed(2),
          three_d_secure_session_id: session.session_id,
        },
      ],
    },
  };
  logRequest("duffel", "POST", ordersUrl, ordersReqBody);
  const res = await fetch(ordersUrl, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(ordersReqBody),
  });
  const json = (await res.json().catch(() => null)) as
    | ({ data?: { id?: string; booking_reference?: string } } & DuffelErrorBody)
    | null;
  logResponse("duffel", "POST", ordersUrl, res.status, json);
  if (!res.ok) {
    return { ok: false, failure_reason: json?.errors?.[0]?.message || `Duffel request failed (${res.status})` };
  }
  if (!json?.data?.id) {
    return { ok: false, failure_reason: "Duffel order creation returned no order id" };
  }
  return { ok: true, order_id: json.data.id, booking_reference: json.data.booking_reference || json.data.id };
}

/**
 * Duffel Stays booking follows the same card + 3DS session shape, but the
 * exact `/stays/bookings` payment payload wasn't verified against current
 * docs while scaffolding this — confirm against docs.duffel.com before
 * wiring hotel legs through this path. Flight legs (payDuffelFlightOrder,
 * above) are verified.
 */
export async function payDuffelStaysBooking(): Promise<DuffelPaymentResult> {
  return { ok: false, failure_reason: "payDuffelStaysBooking not implemented — verify /stays/bookings payment shape first" };
}
