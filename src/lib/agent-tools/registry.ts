/**
 * Real-time concierge tools — flights, hotels, tickets, vendor trust, Prava pay.
 * Used by ElevenLabs webhook/client tools and the text agent loop.
 */

import { searchFlights } from "../integrations/flights";
import { searchHotels } from "../integrations/hotels";
import { searchTickets } from "../integrations/ticketmaster";
import {
  searchClubs,
  searchDining,
  searchMovies,
} from "../integrations/dining";
import { createPravaSession } from "../integrations/prava";
import { lookupVendorTrust } from "../integrations/senso";
import { getWeatherForTravel } from "../integrations/weather";
import { airportCodeForPlace } from "../geo/airports";
import { airlineIataFromName, airlineLogoUrl } from "../geo/airlines";
import { googleFlightsUrl } from "../integrations/linq";

export type AgentToolName =
  | "search_flights"
  | "search_hotels"
  | "search_tickets"
  | "search_dining"
  | "search_clubs"
  | "search_movies"
  | "lookup_vendor"
  | "create_payment"
  | "get_weather"
  | "show_results";

export type AgentToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  /** UI payload for the concierge page */
  ui?: {
    kind:
      | "flights"
      | "hotels"
      | "tickets"
      | "dining"
      | "clubs"
      | "movies"
      | "payment"
      | "vendor"
      | "weather"
      | "message";
    payload: unknown;
  };
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const STAY_PHOTOS = [
  "1566073771259-6a8506099945",
  "1582719508461-905c673771fd",
  "1611892440504-42a792e24d32",
  "1578683010236-d716f9a3f461",
  "1520255672679-06643cd46516",
  "1445019980597-93fa8acb246c",
];
const EVENT_PHOTOS = [
  "1470229722913-7c0e2dbbafd3",
  "1501281668745-f7f57925c3b4",
  "1514525253161-7a46d19cd819",
  "1459749411175-047df92548c0",
  "1429962714451-bb934ecdc4ec",
];
const DINING_PHOTOS = [
  "1414235077428-338989a2e8c0",
  "1517248135467-4c7edcad34c4",
  "1559339352-11d035aa65de",
  "1466978913421-dad2ebd01d17",
];
const CLUB_PHOTO_IDS = [
  "1571266028249-e7016c2a985b",
  "1470225620780-dba8ba36b745",
  "1514525253161-7a46d19cd819",
  "1493225457124-a3eb161ffa5f",
];
const MOVIE_PHOTO_IDS = [
  "1489599849927-2ee91cede3ba",
  "1536440136628-849c177e76a1",
  "1478720568477-152d9b164e26",
  "1594909122845-11baa439b7bf",
];

function stayPhotoUrl(_seed: string, index: number): string {
  const id = STAY_PHOTOS[index % STAY_PHOTOS.length]!;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&q=80`;
}

function eventPhotoUrl(_seed: string, index: number): string {
  const id = EVENT_PHOTOS[index % EVENT_PHOTOS.length]!;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&q=80`;
}

function diningPhotoUrl(index: number): string {
  const id = DINING_PHOTOS[index % DINING_PHOTOS.length]!;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&q=80`;
}

function clubPhotoUrl(index: number): string {
  const id = CLUB_PHOTO_IDS[index % CLUB_PHOTO_IDS.length]!;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&q=80`;
}

function moviePhotoUrl(index: number): string {
  const id = MOVIE_PHOTO_IDS[index % MOVIE_PHOTO_IDS.length]!;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=720&q=80`;
}

export async function executeAgentTool(
  name: string,
  parameters: Record<string, unknown> = {},
): Promise<AgentToolResult> {
  try {
    switch (name as AgentToolName) {
      case "search_flights": {
        const originCity = str(parameters.origin || parameters.origin_city);
        const destCity = str(
          parameters.destination || parameters.destination_city,
        );
        const origin =
          airportCodeForPlace(originCity) ||
          (/^[A-Za-z]{3}$/.test(originCity) ? originCity.toUpperCase() : null);
        const destination =
          airportCodeForPlace(destCity) ||
          (/^[A-Za-z]{3}$/.test(destCity) ? destCity.toUpperCase() : null);
        if (!origin || !destination) {
          return {
            ok: false,
            summary: `Need recognizable origin + destination cities (got ${originCity || "?"} → ${destCity || "?"}).`,
          };
        }
        let depart =
          str(parameters.depart_date || parameters.date) || "2026-08-11";
        // Normalize spoken dates like 11th August → 2026-08-11
        if (!/^\d{4}-\d{2}-\d{2}$/.test(depart)) {
          const m = depart.match(
            /(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
          );
          const months: Record<string, string> = {
            jan: "01",
            feb: "02",
            mar: "03",
            apr: "04",
            may: "05",
            jun: "06",
            jul: "07",
            aug: "08",
            sep: "09",
            oct: "10",
            nov: "11",
            dec: "12",
          };
          if (m) {
            depart = `2026-${months[m[2]!.slice(0, 3).toLowerCase()]}-${String(Number(m[1])).padStart(2, "0")}`;
          }
        }
        let returnDate = str(
          parameters.return_date || parameters.return || parameters.inbound_date,
        );
        if (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
          const m = returnDate.match(
            /(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
          );
          const months: Record<string, string> = {
            jan: "01",
            feb: "02",
            mar: "03",
            apr: "04",
            may: "05",
            jun: "06",
            jul: "07",
            aug: "08",
            sep: "09",
            oct: "10",
            nov: "11",
            dec: "12",
          };
          if (m) {
            returnDate = `2026-${months[m[2]!.slice(0, 3).toLowerCase()]}-${String(Number(m[1])).padStart(2, "0")}`;
          }
        }
        const fl = await searchFlights({
          origin,
          destination,
          depart_date: depart,
          return_date: returnDate || undefined,
        });
        const mapOffer = (o: (typeof fl.offers)[0], source: string) => {
          const iata =
            o.airline_iata || airlineIataFromName(o.airline) || null;
          return {
            id: o.id,
            airline: o.airline,
            airline_iata: iata,
            airline_logo_url: airlineLogoUrl(iata),
            from: o.from,
            to: o.to,
            depart: o.depart,
            arrive: o.arrive,
            cabin: o.cabin,
            price_per_person: o.price_per_person,
            currency: o.currency,
            source,
          };
        };
        const offers = fl.offers.slice(0, 5).map((o) => mapOffer(o, fl.source));
        const returnOffers = (fl.return_offers || [])
          .slice(0, 5)
          .map((o) => mapOffer(o, fl.return_source || fl.source));
        const srcNote =
          fl.source === "duffel"
            ? "live Duffel"
            : "fixture inventory (Duffel empty/unavailable)";
        const retNote = returnOffers.length
          ? ` Return ${destination}→${origin} on ${returnDate}: ${returnOffers.length} options (${fl.return_source || fl.source}).`
          : "";
        return {
          ok: true,
          summary: `Outbound ${origin}→${destination} on ${depart}: ${offers.length} flights via ${srcNote}. Cheapest ~$${Math.round(offers[0]?.price_per_person ?? 0)}/pp.${retNote} Cards are on the user's screen — summarize briefly.`,
          data: {
            offers,
            return_offers: returnOffers,
            source: fl.source,
            return_source: fl.return_source,
          },
          ui: {
            kind: "flights",
            payload: {
              offers,
              return_offers: returnOffers,
              label: `${origin} → ${destination}`,
              return_label: returnOffers.length
                ? `${destination} → ${origin}`
                : undefined,
              source: fl.source,
              return_source: fl.return_source,
              google_flights_url: googleFlightsUrl({
                origin,
                destination,
                depart_date: depart,
                return_date: returnDate || undefined,
              }),
            },
          },
        };
      }

      case "search_hotels": {
        const city = str(parameters.city || parameters.destination);
        if (!city) {
          return { ok: false, summary: "Need a destination city for hotels." };
        }
        const check_in =
          str(parameters.check_in || parameters.checkin) || "2026-09-20";
        const check_out =
          str(parameters.check_out || parameters.checkout) || "2026-09-25";
        const ht = await searchHotels({ city, check_in, check_out });
        const cityLabel = city;
        const offers = ht.offers.slice(0, 6).map((o, i) => ({
          id: o.id,
          name: o.name,
          neighborhood: o.neighborhood,
          check_in: o.check_in,
          check_out: o.check_out,
          nights: o.nights,
          price_total: o.price_total,
          currency: o.currency,
          source: ht.source,
          rating: o.rating ?? null,
          review_count: o.review_count ?? null,
          review_rank: i + 1,
          photo_url: stayPhotoUrl(`${o.name}-${cityLabel}`, i),
        }));
        const top = offers[0];
        return {
          ok: true,
          summary: `Found ${offers.length} stays in ${city}, ranked by reviews. Top: ${top?.name || "n/a"} (${top?.rating ?? "?"}/10) ~$${Math.round(top?.price_total ?? 0)} (${ht.source}). Cards are on screen.`,
          data: { offers, source: ht.source },
          ui: {
            kind: "hotels",
            payload: { offers, label: city, source: ht.source },
          },
        };
      }

      case "search_tickets": {
        const keyword = str(parameters.keyword || parameters.query) || "concert";
        const city = str(parameters.city) || "Chicago";
        const tm = await searchTickets({
          keyword,
          city,
          max_price: num(parameters.max_price),
        });
        const offers = tm.offers.slice(0, 5).map((o, i) => ({
          id: o.id,
          event_name: o.event_name,
          venue: o.venue,
          date: o.date,
          price: o.price,
          currency: o.currency,
          vendor: o.vendor,
          source: tm.source,
          photo_url: eventPhotoUrl(`${o.event_name}-${city}`, i),
        }));
        return {
          ok: true,
          summary: `Found ${offers.length} ticket options for "${keyword}" in ${city}. From ~$${Math.round(offers[0]?.price ?? 0)} (${tm.source}). Cards are on screen.`,
          data: { offers, source: tm.source },
          ui: {
            kind: "tickets",
            payload: { offers, label: `${keyword} · ${city}`, source: tm.source },
          },
        };
      }

      case "lookup_vendor": {
        const vendor = str(parameters.vendor || parameters.name);
        if (!vendor) {
          return { ok: false, summary: "Need a vendor name to look up." };
        }
        const trust = await lookupVendorTrust(vendor);
        return {
          ok: true,
          summary: `Trust for ${trust.vendor}: ${(trust.trust_score * 100).toFixed(0)}% · ${trust.note}`,
          data: trust,
          ui: { kind: "vendor", payload: trust },
        };
      }

      case "search_dining": {
        const city = str(parameters.city || parameters.destination) || "New York";
        const din = await searchDining({
          city,
          max_per_person: num(parameters.max_per_person || parameters.max_price),
          tags: str(parameters.vibe || parameters.cuisine)
            ? [str(parameters.vibe || parameters.cuisine)]
            : undefined,
        });
        const offers = din.offers.slice(0, 5).map((o, i) => ({
          id: o.id,
          name: o.vendor,
          cuisine: o.cuisine,
          neighborhood: o.neighborhood,
          time: o.time,
          price_per_person: o.price_per_person,
          currency: o.currency,
          party_size: o.party_size,
          source: din.source,
          photo_url: diningPhotoUrl(i),
        }));
        return {
          ok: true,
          summary: `Found ${offers.length} dinner spots in ${din.city}. From ~$${Math.round(offers[0]?.price_per_person ?? 0)}/pp. Cards are on screen.`,
          data: { offers, source: din.source },
          ui: {
            kind: "dining",
            payload: { offers, label: din.city, source: din.source },
          },
        };
      }

      case "search_clubs": {
        const city = str(parameters.city || parameters.destination) || "New York";
        const cl = await searchClubs({
          city,
          vibe: str(parameters.vibe || parameters.keyword),
        });
        const offers = cl.offers.slice(0, 5).map((o, i) => ({
          id: o.id,
          name: o.name,
          neighborhood: o.neighborhood,
          vibe: o.vibe,
          cover: o.cover,
          open_until: o.open_until,
          currency: o.currency,
          source: cl.source,
          photo_url: clubPhotoUrl(i),
        }));
        return {
          ok: true,
          summary: `Found ${offers.length} clubs in ${cl.city}. Cover from ~$${Math.round(offers[0]?.cover ?? 0)}. Cards are on screen.`,
          data: { offers, source: cl.source },
          ui: {
            kind: "clubs",
            payload: { offers, label: cl.city, source: cl.source },
          },
        };
      }

      case "search_movies": {
        const city = str(parameters.city || parameters.destination) || "New York";
        const mv = await searchMovies({
          city,
          title: str(parameters.title || parameters.keyword),
        });
        const offers = mv.offers.slice(0, 5).map((o, i) => ({
          id: o.id,
          title: o.title,
          theater: o.theater,
          neighborhood: o.neighborhood,
          showtimes: o.showtimes,
          price: o.price,
          rating: o.rating,
          currency: o.currency,
          source: mv.source,
          photo_url: moviePhotoUrl(i),
        }));
        return {
          ok: true,
          summary: `Found ${offers.length} movies in ${mv.city}. Tickets from ~$${Math.round(offers[0]?.price ?? 0)}. Cards are on screen.`,
          data: { offers, source: mv.source },
          ui: {
            kind: "movies",
            payload: { offers, label: mv.city, source: mv.source },
          },
        };
      }

      case "get_weather": {
        const city = str(parameters.city || parameters.destination);
        const date = str(
          parameters.date || parameters.depart_date || parameters.check_in,
        );
        if (!city || !date) {
          return {
            ok: false,
            summary:
              "Need a destination city and a first travel date (YYYY-MM-DD) for weather.",
          };
        }
        const w = await getWeatherForTravel(city, date);
        const tempText =
          w.mode === "forecast"
            ? `high ${Math.round(w.temp_high ?? 0)}°F / low ${Math.round(w.temp_low ?? 0)}°F`
            : `currently ${Math.round(w.temperature ?? 0)}°F`;
        const caution = w.extreme
          ? "Caution: extreme weather forecasted — flag it to the traveler."
          : "Looks fine.";
        const headline =
          w.mode === "forecast"
            ? `Forecast for ${w.place} on ${w.date}`
            : `${w.place} travel date is more than 10 days out — showing current conditions instead of a forecast`;
        return {
          ok: true,
          summary: `${headline}: ${w.condition}, ${tempText}. ${caution} Card is on screen.`,
          data: w,
          ui: { kind: "weather", payload: w },
        };
      }

      case "create_payment": {
        const merchant = str(parameters.merchant) || "AiDHD booking";
        const amount = num(parameters.amount);
        const category = str(parameters.category) || "trip";
        const email =
          str(parameters.email || parameters.user_email) ||
          "traveler@aidhd.app";
        if (amount == null || amount <= 0) {
          return {
            ok: false,
            summary: "Need a positive amount (USD) to start Prava payment.",
          };
        }
        const session = await createPravaSession({
          user_id: str(parameters.user_id) || `agent_${Date.now()}`,
          user_email: email,
          merchant,
          amount,
          currency: str(parameters.currency) || "USD",
          category,
        });
        const payUrl =
          session.iframe_url ||
          (session.session_id
            ? `https://aidhd-omega.vercel.app/pay?session=${encodeURIComponent(session.session_id)}`
            : null);
        if (session.error) {
          return {
            ok: false,
            summary: `Prava session error: ${session.error}`,
            data: session,
          };
        }
        return {
          ok: true,
          summary: `Prava checkout is open on their screen for $${amount.toFixed(2)} to ${merchant} (${session.mode}). Ask them to approve passkey/card there — do not read URLs aloud.`,
          data: { ...session, pay_url: payUrl },
          ui: {
            kind: "payment",
            payload: {
              session_id: session.session_id,
              session_token: session.session_token || undefined,
              iframe_url: session.iframe_url || payUrl,
              pay_url: payUrl,
              amount,
              merchant,
              category,
              mode: session.mode,
            },
          },
        };
      }

      case "show_results": {
        return {
          ok: true,
          summary: "Results displayed to the user.",
          ui: {
            kind: "message",
            payload: { text: str(parameters.message || parameters.text) },
          },
        };
      }

      default:
        return {
          ok: false,
          summary: `Unknown tool "${name}". Use search_flights, search_hotels, search_tickets, search_dining, search_clubs, search_movies, lookup_vendor, get_weather, or create_payment.`,
        };
    }
  } catch (e) {
    return {
      ok: false,
      summary: e instanceof Error ? e.message : "Tool failed",
    };
  }
}

/** Prompt + tool schemas for ElevenLabs agent sync / Gemini chat. */
export const CONCIERGE_SYSTEM_PROMPT = `You are AiDHD — a high-functioning group trip & night-out operator (hackathon demo).

IDENTITY
- Sharp, warm, concise. Human — never hotel front-desk or call-center.
- Never invent prices. Always call tools before quoting.
- NEVER collect passport numbers, full card numbers, or CVV by voice/chat.
  Say: "Add that in the AiDHD secure vault — I only get a reference, not the secret."
- Cards for options appear on the user's screen. After a search, highlight 2–3 options and say the rest are on screen.

CAPABILITIES
- Flights (round-trip: ALWAYS pass return_date YYYY-MM-DD in the same search_flights call)
- Hotels, tickets, dinner, clubs, movies
- get_weather(city, date) → call this right after a destination city + first travel date is established
  (e.g., right after search_flights or search_hotels). Mention the outlook briefly and clearly flag
  any extreme weather caution shown on the card.
- create_payment → opens Prava on screen (do not read long URLs aloud)
- iMessage users may also be chatting via Linq — keep answers short; confirmations land in-thread

FLOW
1) Intent: outing vs trip, cities, dates, budget, party size
2) Tool search immediately
3) Once destination + first travel date are known: call get_weather
4) On pick: confirm total → create_payment
5) If vault missing for ticketing, still show offers; say booking finalizes after vault + Prava

EDGE CASES
- Ambiguous city → ask once, then search
- Empty inventory → say so honestly; mention Google Flights link on the card if present
- Goodbye → brief bye (no property FAQ / modify reservation script)
- Interruptions → follow the new ask
- STOP / opt-out is handled by messaging layer — don't argue`;

/**
 * Client tools run in the browser ConciergeAgent — required so cards paint on Vercel
 * (serverless webhooks can't share in-memory UI state with the page).
 */
export function elevenLabsToolDefinitions(_baseUrl?: string) {
  const prop = (description: string, type: "string" | "number" = "string") => ({
    type,
    description,
  });
  const client = (
    name: string,
    description: string,
    properties: Record<string, unknown>,
    required: string[],
  ) => ({
    type: "client" as const,
    name,
    description,
    expects_response: true,
    response_timeout_secs: 45,
    parameters: {
      type: "object",
      properties,
      required,
    },
  });

  return [
    client("search_flights", "Search flights. For round trips pass return_date too.", {
      origin: prop("Origin city or IATA"),
      destination: prop("Destination city or IATA"),
      depart_date: prop("Outbound date YYYY-MM-DD"),
      return_date: prop("Optional return date YYYY-MM-DD"),
    }, ["origin", "destination"]),
    client("search_hotels", "Search stays ranked by guest reviews.", {
      city: prop("Destination city"),
      check_in: prop("YYYY-MM-DD"),
      check_out: prop("YYYY-MM-DD"),
    }, ["city"]),
    client("search_tickets", "Search concert/event tickets by keyword and city.", {
      keyword: prop("Artist, event, or vibe"),
      city: prop("City name"),
    }, ["keyword"]),
    client("search_dining", "Recommend dinner / restaurants in a city.", {
      city: prop("City name"),
      cuisine: prop("Optional cuisine or vibe"),
      max_per_person: prop("Optional max USD per person", "number"),
    }, ["city"]),
    client("search_clubs", "Recommend nightlife clubs in a city.", {
      city: prop("City name"),
      vibe: prop("Optional vibe e.g. techno, disco, chill"),
    }, ["city"]),
    client("search_movies", "Recommend movies and showtimes in a city.", {
      city: prop("City name"),
      title: prop("Optional movie title keyword"),
    }, ["city"]),
    client("lookup_vendor", "Look up vendor trust / reputation score.", {
      vendor: prop("Merchant or venue name"),
    }, ["vendor"]),
    client(
      "get_weather",
      "Get weather for the destination's first travel date — forecast if within 10 days, else current conditions. Call once city + first travel date are known.",
      {
        city: prop("Destination city"),
        date: prop("First day of travel (arrival/departure date), YYYY-MM-DD"),
      },
      ["city", "date"],
    ),
    client("create_payment", "Start Prava payment and open on-screen checkout.", {
      merchant: prop("What they are paying for"),
      amount: prop("USD total amount", "number"),
      category: prop("flight | hotel | ticket | dining | club | movie | trip"),
      email: prop("Payer email"),
    }, ["amount", "merchant"]),
    client("show_results", "Optional nudge that results are on screen.", {
      kind: prop("flights | hotels | tickets | dining | clubs | movies | payment | message"),
      message: prop("Optional status text"),
    }, []),
  ];
}
