import {
  HOTEL_INVENTORY,
  ITINERARY_INVENTORY,
  type HotelOffer,
  type ItineraryDayOffer,
} from "../merchants/fixtures";
import { hasAmadeus } from "./config";

/**
 * Hotel search — Amadeus when keyed, else fixtures.
 * Reserve stays mock for hackathon disclosure.
 */
export async function searchHotels(input: {
  city?: string;
  max_total?: number;
}): Promise<{ offers: HotelOffer[]; source: "amadeus" | "fixture" }> {
  if (hasAmadeus()) {
    // Live Amadeus hotel search needs OAuth token exchange; fixtures keep demo reliable.
    // When AMADEUS_API_KEY + AMADEUS_API_SECRET are set we still prefer fixtures for
    // weekend reliability unless AMADEUS_LIVE=1.
    if (process.env.AMADEUS_LIVE === "1") {
      try {
        const tokenRes = await fetch(
          "https://test.api.amadeus.com/v1/security/oauth2/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: process.env.AMADEUS_API_KEY!,
              client_secret: process.env.AMADEUS_API_SECRET!,
            }),
          },
        );
        if (tokenRes.ok) {
          const { access_token } = (await tokenRes.json()) as {
            access_token: string;
          };
          const city = input.city === "Miami" ? "MIA" : "MIA";
          const res = await fetch(
            `https://test.api.amadeus.com/v3/shopping/hotel-offers?cityCode=${city}&adults=2&roomQuantity=1`,
            { headers: { Authorization: `Bearer ${access_token}` } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              data?: Array<{
                hotel?: { hotelId?: string; name?: string };
                offers?: Array<{
                  id?: string;
                  price?: { total?: string; currency?: string };
                }>;
              }>;
            };
            const offers: HotelOffer[] = (data.data ?? []).slice(0, 5).map((h, i) => ({
              id: h.offers?.[0]?.id || h.hotel?.hotelId || `amadeus_${i}`,
              vendor: "Amadeus",
              name: h.hotel?.name || "Miami Hotel",
              neighborhood: input.city || "Miami",
              check_in: "2026-08-14",
              check_out: "2026-08-16",
              nights: 2,
              price_total: Number(h.offers?.[0]?.price?.total || 400),
              currency: h.offers?.[0]?.price?.currency || "USD",
              tags: ["live", "amadeus"],
            }));
            if (offers.length) return { offers, source: "amadeus" };
          }
        }
      } catch {
        // fall through
      }
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
    mode: hasAmadeus() ? ("amadeus-hold-mock" as const) : ("fixture" as const),
  };
}
