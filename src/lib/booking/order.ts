/**
 * Order creation — the only call here that spends money.
 *
 * Two deliberate guards:
 *  - `consent` must carry an explicit acceptance of the quoted terms and the
 *    exact amount the user approved. A mismatch against the live re-price
 *    aborts rather than silently charging a different number.
 *  - An idempotency key is required. If the response is lost in flight, the
 *    retry cannot produce a second ticket — which is the failure mode browser
 *    automation cannot protect against.
 */

import { quoteOffer, type Quote } from "./quote";
import { preparePayment, type VirtualCard } from "./payment";

const API_HOST = "https://api.duffel.com";

export type Passenger = {
  /** Duffel passenger id from the offer. */
  id: string;
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  given_name: string;
  family_name: string;
  born_on: string;
  gender: "m" | "f";
  email: string;
  phone_number: string;
  passport_number: string;
  passport_expires_on: string;
  nationality: string;
};

export type Consent = {
  /** Amount shown to the user at the moment they approved. */
  approved_amount: string;
  approved_currency: string;
  /** Set only after the user actively confirms the terms summary. */
  accepted_conditions: boolean;
  accepted_at: string;
};

export type OrderResult =
  | {
      ok: true;
      booking_reference: string;
      order_id: string;
      ticket_numbers: string[];
      amount: string;
      currency: string;
      quote: Quote;
    }
  | { ok: false; stage: string; error: string; retryable: boolean };

export async function createOrder(input: {
  offer_id: string;
  passengers: Passenger[];
  consent: Consent;
  idempotency_key: string;
  card?: VirtualCard | null;
}): Promise<OrderResult> {
  if (!input.consent.accepted_conditions) {
    return {
      ok: false,
      stage: "consent",
      error: "Terms were not explicitly accepted.",
      retryable: false,
    };
  }

  // Re-price first: the approved amount must still be the real amount.
  const priced = await quoteOffer(input.offer_id);
  if (!priced.ok) {
    return {
      ok: false,
      stage: "quote",
      error: priced.error,
      retryable: !priced.expired,
    };
  }
  const quote = priced.quote;

  if (
    quote.amount !== input.consent.approved_amount ||
    quote.currency !== input.consent.approved_currency
  ) {
    return {
      ok: false,
      stage: "price_changed",
      error: `Price moved from ${input.consent.approved_amount} ${input.consent.approved_currency} to ${quote.amount} ${quote.currency}. Re-confirm before booking.`,
      retryable: false,
    };
  }

  const payment = await preparePayment({
    offer_id: input.offer_id,
    amount: quote.amount,
    currency: quote.currency,
    card: input.card ?? null,
  });
  if (!payment.ok) {
    return {
      ok: false,
      stage: payment.stage,
      error: payment.error,
      // An entitlement gap will not fix itself on retry.
      retryable: payment.entitlement !== "unavailable",
    };
  }

  const res = await fetch(`${API_HOST}/air/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DUFFEL_API_KEY || ""}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": input.idempotency_key,
    },
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [input.offer_id],
        payments: [payment.plan],
        passengers: input.passengers.map((p) => ({
          id: p.id,
          title: p.title,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender,
          email: p.email,
          phone_number: p.phone_number,
          identity_documents: [
            {
              type: "passport",
              unique_identifier: p.passport_number,
              expires_on: p.passport_expires_on,
              issuing_country_code: p.nationality,
            },
          ],
        })),
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      id?: string;
      booking_reference?: string;
      documents?: Array<{ type?: string; unique_identifier?: string }>;
    };
    errors?: Array<{ title?: string; message?: string; code?: string }>;
  };

  if (!res.ok || !body.data?.id) {
    const err = body.errors?.[0];
    return {
      ok: false,
      stage: "order",
      error: err?.message || err?.title || `Order failed (HTTP ${res.status})`,
      // 5xx may be transient; the idempotency key makes a retry safe. 4xx will not.
      retryable: res.status >= 500,
    };
  }

  return {
    ok: true,
    booking_reference: body.data.booking_reference || body.data.id,
    order_id: body.data.id,
    ticket_numbers: (body.data.documents ?? [])
      .filter((d) => d.type === "electronic_ticket")
      .map((d) => d.unique_identifier ?? "")
      .filter(Boolean),
    amount: quote.amount,
    currency: quote.currency,
    quote,
  };
}
