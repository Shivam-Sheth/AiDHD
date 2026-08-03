/**
 * Re-price an offer immediately before booking and pull the real fare
 * conditions out of it.
 *
 * Two reasons this step exists:
 *  - Offers expire and prices move. Duffel returns the authoritative amount
 *    here, which is what the user approves and what we then charge.
 *  - The refund/change penalties and baggage allowance below are the actual
 *    contract terms from the airline. This is what the consent screen shows,
 *    rather than a block of scraped legal text.
 */

const API_HOST = "https://api.duffel.com";

export type FareCondition = {
  label: string;
  allowed: boolean | null;
  penalty: string | null;
};

export type Quote = {
  offer_id: string;
  amount: string;
  currency: string;
  base_amount: string | null;
  tax_amount: string | null;
  expires_at: string | null;
  owner: string;
  passenger_ids: string[];
  conditions: FareCondition[];
  baggage: string[];
  segments: Array<{
    origin: string;
    destination: string;
    departing_at: string;
    arriving_at: string;
    marketing_carrier: string;
    flight_number: string;
  }>;
};

type DuffelCondition = {
  allowed?: boolean;
  penalty_amount?: string | null;
  penalty_currency?: string | null;
} | null;

function readCondition(label: string, c: DuffelCondition): FareCondition {
  if (!c) return { label, allowed: null, penalty: null };
  const penalty =
    c.penalty_amount && c.penalty_currency ? `${c.penalty_amount} ${c.penalty_currency}` : null;
  return { label, allowed: c.allowed ?? null, penalty };
}

export async function quoteOffer(
  offerId: string,
): Promise<{ ok: true; quote: Quote } | { ok: false; error: string; expired: boolean }> {
  const res = await fetch(
    `${API_HOST}/air/offers/${encodeURIComponent(offerId)}?return_available_services=false`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_API_KEY || ""}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
      },
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    errors?: Array<{ code?: string; title?: string; message?: string }>;
  };

  if (!res.ok || !body.data) {
    const err = body.errors?.[0];
    return {
      ok: false,
      expired: err?.code === "offer_no_longer_available" || res.status === 404,
      error: err?.message || err?.title || `Could not re-price offer (HTTP ${res.status})`,
    };
  }

  const d = body.data as {
    id: string;
    total_amount: string;
    total_currency: string;
    base_amount?: string;
    tax_amount?: string;
    expires_at?: string;
    owner?: { name?: string };
    passengers?: Array<{ id: string }>;
    conditions?: {
      refund_before_departure?: DuffelCondition;
      change_before_departure?: DuffelCondition;
    };
    slices?: Array<{
      segments?: Array<{
        origin?: { iata_code?: string };
        destination?: { iata_code?: string };
        departing_at?: string;
        arriving_at?: string;
        marketing_carrier?: { iata_code?: string; name?: string };
        marketing_carrier_flight_number?: string;
        passengers?: Array<{
          baggages?: Array<{ type?: string; quantity?: number }>;
        }>;
      }>;
    }>;
  };

  const segments = (d.slices ?? []).flatMap((s) =>
    (s.segments ?? []).map((seg) => ({
      origin: seg.origin?.iata_code ?? "???",
      destination: seg.destination?.iata_code ?? "???",
      departing_at: seg.departing_at ?? "",
      arriving_at: seg.arriving_at ?? "",
      marketing_carrier: seg.marketing_carrier?.name ?? seg.marketing_carrier?.iata_code ?? "",
      flight_number: seg.marketing_carrier_flight_number ?? "",
    })),
  );

  // Baggage is quoted per segment per passenger; collapse to distinct lines so
  // the consent screen shows "1 checked bag" rather than one row per leg.
  const bags = new Set<string>();
  for (const slice of d.slices ?? []) {
    for (const seg of slice.segments ?? []) {
      for (const p of seg.passengers ?? []) {
        for (const b of p.baggages ?? []) {
          if (!b.type) continue;
          const label = b.type === "carry_on" ? "carry-on" : b.type;
          bags.add(`${b.quantity ?? 0} × ${label}`);
        }
      }
    }
  }

  return {
    ok: true,
    quote: {
      offer_id: d.id,
      amount: d.total_amount,
      currency: d.total_currency,
      base_amount: d.base_amount ?? null,
      tax_amount: d.tax_amount ?? null,
      expires_at: d.expires_at ?? null,
      owner: d.owner?.name ?? "",
      passenger_ids: (d.passengers ?? []).map((p) => p.id),
      conditions: [
        readCondition("Refund before departure", d.conditions?.refund_before_departure ?? null),
        readCondition("Change before departure", d.conditions?.change_before_departure ?? null),
      ],
      baggage: [...bags],
      segments,
    },
  };
}
