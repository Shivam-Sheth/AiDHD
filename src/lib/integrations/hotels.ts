import {
  HOTEL_INVENTORY,
  ITINERARY_INVENTORY,
  type HotelOffer,
  type ItineraryDayOffer,
} from "../merchants/fixtures";
import { coordsForCity, displayCityForPlace } from "../geo/airports";
import { hasDuffel } from "./config";

function rewriteHotelFixtures(input: {
  city: string;
  checkIn: string;
  checkOut: string;
  max_total?: number;
}): HotelOffer[] {
  const city = displayCityForPlace(input.city);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${input.checkOut}T12:00:00Z`).getTime() -
        new Date(`${input.checkIn}T12:00:00Z`).getTime()) /
        86_400_000,
    ),
  );
  const offers: HotelOffer[] = HOTEL_INVENTORY.map((h, i) => ({
    ...h,
    id: `${h.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    name: h.name.replace(/Miami( Beach)?/gi, city).replace(/South Beach/gi, city),
    neighborhood: i === 0 ? "Downtown" : i === 1 ? "Center" : "Upscale",
    check_in: input.checkIn,
    check_out: input.checkOut,
    nights,
    tags: [...h.tags.filter((t) => t !== "beach"), "rewritten-city", city.toLowerCase()],
  }));
  if (input.max_total == null) return offers;
  const capped = offers.filter((o) => o.price_total <= input.max_total!);
  return capped.length ? capped : offers.sort((a, b) => a.price_total - b.price_total);
}

/**
 * Hotel / stays search — Duffel Stays when keyed.
 * City coords come from geo lookup — never assume Miami/NYC for unknown places.
 */
export async function searchHotels(input: {
  city?: string;
  check_in?: string;
  check_out?: string;
  max_total?: number;
}): Promise<{ offers: HotelOffer[]; source: "duffel" | "fixture" }> {
  const city = (input.city || "").trim();
  if (!city) {
    throw new Error("searchHotels requires a destination city");
  }
  const checkIn = input.check_in || "2026-08-14";
  const checkOut = input.check_out || "2026-08-16";
  const coords = coordsForCity(city);

  if (hasDuffel() && coords) {
    try {
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
            check_in_date: checkIn,
            check_out_date: checkOut,
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
              r.accommodation?.location?.address?.city_name || city,
            check_in: checkIn,
            check_out: checkOut,
            nights: Math.max(
              1,
              Math.round(
                (new Date(`${checkOut}T12:00:00Z`).getTime() -
                  new Date(`${checkIn}T12:00:00Z`).getTime()) /
                  86_400_000,
              ),
            ),
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

  return {
    offers: rewriteHotelFixtures({
      city,
      checkIn,
      checkOut,
      max_total: input.max_total,
    }),
    source: "fixture",
  };
}

export async function searchItineraryDays(): Promise<ItineraryDayOffer[]> {
  return [...ITINERARY_INVENTORY];
}

export async function reserveHotel(offerId: string, fail = false) {
  if (fail) {
    return {
      ok: false as const,
      confirmation_id: undefined,
      failure_reason: "Stay inventory flickered — re-mandate hotel only",
    };
  }
  return {
    ok: true as const,
    confirmation_id: `MOCK-HOTEL-${offerId}-${Date.now()}`,
    mode: hasDuffel() ? ("duffel-hold-mock" as const) : ("fixture" as const),
  };
}
