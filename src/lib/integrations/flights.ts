import {
  FLIGHT_INVENTORY,
  type FlightOffer,
} from "../merchants/fixtures";
import { hasDuffel } from "./config";

/**
 * Flight search — Duffel when keyed, else realistic fixtures.
 * Checkout/reserve stays mock for the hackathon (same disclosure as Ticketmaster).
 */
export async function searchFlights(input: {
  origin?: string;
  destination?: string;
  max_price?: number;
}): Promise<{ offers: FlightOffer[]; source: "duffel" | "fixture" }> {
  if (hasDuffel()) {
    try {
      const res = await fetch("https://api.duffel.com/air/offer_requests", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DUFFEL_API_KEY}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin: input.origin || "JFK",
                destination: input.destination || "MIA",
                departure_date: "2026-08-14",
              },
            ],
            passengers: [{ type: "adult" }],
            cabin_class: "economy",
          },
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: {
            offers?: Array<{
              id: string;
              total_amount?: string;
              owner?: { name?: string };
              slices?: Array<{
                segments?: Array<{
                  originating_airport_iata_code?: string;
                  destination_airport_iata_code?: string;
                  departing_at?: string;
                  arriving_at?: string;
                  passengers?: Array<{ cabin_class_marketing_name?: string }>;
                }>;
              }>;
            }>;
          };
        };
        const offers: FlightOffer[] = (json.data?.offers ?? []).slice(0, 5).map((o) => {
          const seg = o.slices?.[0]?.segments?.[0];
          return {
            id: o.id,
            vendor: `Duffel / ${o.owner?.name || "Airline"}`,
            airline: o.owner?.name || "Airline",
            from: seg?.originating_airport_iata_code || input.origin || "JFK",
            to: seg?.destination_airport_iata_code || input.destination || "MIA",
            depart: seg?.departing_at || "2026-08-14T08:00:00-04:00",
            arrive: seg?.arriving_at || "2026-08-14T11:00:00-04:00",
            cabin: seg?.passengers?.[0]?.cabin_class_marketing_name || "Economy",
            price_per_person: Number(o.total_amount || 199),
            currency: "USD",
            tags: ["live", "duffel"],
          };
        });
        if (offers.length) return { offers, source: "duffel" };
      }
    } catch {
      // fall through
    }
  }

  let offers = [...FLIGHT_INVENTORY];
  if (input.max_price != null) {
    offers = offers.filter((o) => o.price_per_person <= input.max_price!);
  }
  return { offers: offers.length ? offers : FLIGHT_INVENTORY, source: "fixture" };
}

export async function reserveFlight(offerId: string, fail = false) {
  if (fail) {
    return {
      ok: false as const,
      confirmation_id: undefined,
      failure_reason: "Airline inventory flickered — re-mandate flight only",
    };
  }
  return {
    ok: true as const,
    confirmation_id: `MOCK-FLIGHT-${offerId}-${Date.now()}`,
    mode: hasDuffel() ? ("duffel-hold-mock" as const) : ("fixture" as const),
  };
}
