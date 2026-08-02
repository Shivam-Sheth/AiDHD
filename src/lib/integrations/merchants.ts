/**
 * Curated brand → official homepage lookup, used to fill `merchant_details.url`
 * for Prava sessions (docs.prava.space: url is a required field — confirmed by
 * testing, dropping it returns 400 VAL_2001). This is a homepage URL, not a
 * booking deep link — Prava's own worked example uses "https://www.hilton.com/en/"
 * for a specific room/date booking, not a property- or date-scoped URL.
 *
 * Deliberately NOT a source of booking deep links. Getting an exact bookable
 * URL/rate for "1 night at a specific Hilton in New York on a specific date"
 * requires a real inventory API (this repo already has one: Duffel, wired in
 * hotels.ts/flights.ts for search, with hold/booking intentionally mocked per
 * the README) — not scraping or crawling brand websites. See the review this
 * file shipped with for why.
 */

type MerchantEntry = {
  /** Canonical brand name as shown to the user / sent to Prava. */
  name: string;
  url: string;
  category: "hotel" | "flight" | "ticket" | "dining" | "movie";
  /** Lowercase alternate names/misspellings this brand should match on. */
  aliases?: string[];
};

const MERCHANT_DIRECTORY: MerchantEntry[] = [
  // Hotels
  { name: "Hilton", url: "https://www.hilton.com/en/", category: "hotel" },
  { name: "Marriott", url: "https://www.marriott.com/", category: "hotel" },
  { name: "Hyatt", url: "https://www.hyatt.com/", category: "hotel" },
  { name: "IHG", url: "https://www.ihg.com/", category: "hotel", aliases: ["intercontinental", "holiday inn"] },
  { name: "Four Seasons", url: "https://www.fourseasons.com/", category: "hotel" },
  { name: "Ritz-Carlton", url: "https://www.ritzcarlton.com/", category: "hotel", aliases: ["the ritz-carlton"] },
  { name: "Best Western", url: "https://www.bestwestern.com/", category: "hotel" },
  { name: "Wyndham", url: "https://www.wyndhamhotels.com/", category: "hotel" },
  { name: "Accor", url: "https://all.accor.com/", category: "hotel", aliases: ["sofitel", "novotel", "ibis"] },
  { name: "Airbnb", url: "https://www.airbnb.com/", category: "hotel" },
  { name: "W Hotels", url: "https://www.marriott.com/en-us/hotels/travel/brands/w-hotels", category: "hotel", aliases: ["w hotel"] },

  // Flights
  { name: "Frontier Airlines", url: "https://www.flyfrontier.com/", category: "flight", aliases: ["frontier"] },
  { name: "Delta", url: "https://www.delta.com/", category: "flight", aliases: ["delta air lines", "delta airlines"] },
  { name: "United Airlines", url: "https://www.united.com/", category: "flight", aliases: ["united"] },
  { name: "American Airlines", url: "https://www.aa.com/", category: "flight", aliases: ["american"] },
  { name: "Southwest Airlines", url: "https://www.southwest.com/", category: "flight", aliases: ["southwest"] },
  { name: "JetBlue", url: "https://www.jetblue.com/", category: "flight" },
  { name: "Alaska Airlines", url: "https://www.alaskaair.com/", category: "flight", aliases: ["alaska"] },
  { name: "Spirit Airlines", url: "https://www.spirit.com/", category: "flight", aliases: ["spirit"] },

  // Tickets
  { name: "Ticketmaster", url: "https://www.ticketmaster.com/", category: "ticket" },
  { name: "StubHub", url: "https://www.stubhub.com/", category: "ticket" },
  { name: "AXS", url: "https://www.axs.com/", category: "ticket" },
  { name: "SeatGeek", url: "https://seatgeek.com/", category: "ticket" },
  { name: "Eventbrite", url: "https://www.eventbrite.com/", category: "ticket" },

  // Dining
  { name: "OpenTable", url: "https://www.opentable.com/", category: "dining" },
  { name: "Resy", url: "https://resy.com/", category: "dining" },

  // Movies
  { name: "Fandango", url: "https://www.fandango.com/", category: "movie" },
  { name: "AMC Theatres", url: "https://www.amctheatres.com/", category: "movie", aliases: ["amc"] },
  { name: "Regal Cinemas", url: "https://www.regmovies.com/", category: "movie", aliases: ["regal"] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(hotel|hotels|resort|resorts|airlines?|air|inc\.?|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Best-effort brand → official homepage. Returns undefined for anything not in the curated list (local venues, restaurants, clubs). */
export function lookupMerchantUrl(merchantName: string): string | undefined {
  if (!merchantName) return undefined;
  const needle = normalize(merchantName);
  if (!needle) return undefined;
  for (const entry of MERCHANT_DIRECTORY) {
    const candidates = [entry.name, ...(entry.aliases || [])];
    for (const c of candidates) {
      const hay = normalize(c);
      if (hay && (needle.includes(hay) || hay.includes(needle))) {
        return entry.url;
      }
    }
  }
  return undefined;
}
