import {
  HOTEL_INVENTORY,
  ITINERARY_INVENTORY,
  type HotelOffer,
  type ItineraryDayOffer,
} from "../merchants/fixtures";
import { hasDuffel } from "./config";

/**
 * Hotel / stays search — Duffel Stays when keyed (Amadeus self-service is dead).
 * Docs: https://duffel.com/docs/guides/getting-started-with-stays
 * Reserve stays mock for hackathon disclosure.
 */
export async function searchHotels(input: {
  city?: string;
  max_total?: number;
}): Promise<{ offers: HotelOffer[]; source: "duffel" | "fixture" }> {
  if (hasDuffel()) {
    try {
      // Miami Beach coords for NYC→Miami demo; generic city fallback later.
      const coords =
        input.city?.toLowerCase().includes("miami") || !input.city
          ? { latitude: 25.7907, longitude: -80.13 }
          : { latitude: 40.758, longitude: -73.9855 };

      const res = await fetch("https://api.duffel.com/stays/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            rooms: 1,
            adults: 2,
            check_in_date: "2026-08-14",
            check_out_date: "2026-08-16",
            location: {
              radius: 8,
              geographic_coordinates: coords,
            },
          },
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          data?: {
            results?: Array<{
              id: string;
              accommodation?: {
                name?: string;
                location?: { address?: { city_name?: string } };
              };
              cheapest_rate_total_amount?: string;
              cheapest_rate_currency?: string;
            }>;
          };
        };
        const offers: HotelOffer[] = (json.data?.results ?? [])
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            vendor: "Duffel Stays",
            name: r.accommodation?.name || "Hotel",
            neighborhood:
              r.accommodation?.location?.address?.city_name ||
              input.city ||
              "Miami",
            check_in: "2026-08-14",
            check_out: "2026-08-16",
            nights: 2,
            price_total: Number(r.cheapest_rate_total_amount || 400),
            currency: r.cheapest_rate_currency || "USD",
            tags: ["live", "duffel", "stays"],
          }));
        if (offers.length) return { offers, source: "duffel" };
      }
    } catch {
      // fall through to fixtures
    }
  }

  let offers = [...HOTEL_INVENTORY];
  if (input.max_total != null) {
    offers = offers.filter((o) => o.price_total <= input.max_total!);
  }
  return { offers: offers.length ? offers : HOTEL_INVENTORY, source: "fixture" };
}

export async function searchItineraryDays(): Promise<ItineraryDayOffer[]> {
  return [...ITINERARY_INVENTORY];
}

export async function reserveHotel(offerId: string, fail = false) {
  if (fail) {
    return {
      ok: false as const,
      confirmation_id: undefined,
      failure_reason: "Hotel rate expired — re-mandate hotel only",
    };
  }
  return {
    ok: true as const,
    confirmation_id: `MOCK-HOTEL-${offerId}-${Date.now()}`,
    mode: hasDuffel() ? ("duffel-stays-hold-mock" as const) : ("fixture" as const),
  };
}
