import {
  FLIGHT_INVENTORY,
  type FlightOffer,
} from "../merchants/fixtures";
import { airlineIataFromName } from "../geo/airlines";
import { hasDuffel } from "./config";

function withIata(o: FlightOffer): FlightOffer {
  return {
    ...o,
    airline_iata: o.airline_iata || airlineIataFromName(o.airline) || undefined,
  };
}

function synthFixtures(input: {
  origin: string;
  destination: string;
  departDate: string;
  max_price?: number;
}): FlightOffer[] {
  // Long-haul (e.g. US → Bali) needs realistic tiers, not domestic $129 stubs
  const intl =
    (input.origin === "ORD" ||
      input.origin === "JFK" ||
      input.origin === "LAX" ||
      input.origin === "SFO") &&
    (input.destination === "DPS" ||
      input.destination === "BKK" ||
      input.destination === "SIN" ||
      input.destination === "HND" ||
      input.destination === "CDG" ||
      input.destination === "LHR" ||
      input.destination === "DXB" ||
      input.destination === "DEL" ||
      input.destination === "BOM");

  const base = intl
    ? [
        { id: "flt_budget", airline: "Scoot", iata: "TR", cabin: "Economy", price: 620, hour: 8 },
        { id: "flt_match", airline: "United", iata: "UA", cabin: "Economy", price: 780, hour: 11 },
        { id: "flt_flex", airline: "American", iata: "AA", cabin: "Premium Economy", price: 980, hour: 14 },
        { id: "flt_splurge", airline: "Japan Airlines", iata: "JL", cabin: "Business", price: 2100, hour: 16 },
      ]
    : [
        { id: "flt_budget", airline: "JetBlue", iata: "B6", cabin: "Basic", price: 129, hour: 8 },
        { id: "flt_match", airline: "American", iata: "AA", cabin: "Main Cabin", price: 189, hour: 11 },
        { id: "flt_splurge", airline: "Delta", iata: "DL", cabin: "Comfort+", price: 279, hour: 16 },
      ];
  const offers: FlightOffer[] = base.map((b, i) => {
    const depart = `${input.departDate}T${String(b.hour).padStart(2, "0")}:${i === 1 ? "40" : "15"}:00`;
    const arriveHour = Math.min(23, b.hour + (intl ? 0 : 3));
    const arriveDate = intl
      ? (() => {
          const d = new Date(`${input.departDate}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() + 1);
          return d.toISOString().slice(0, 10);
        })()
      : input.departDate;
    return {
      id: `${b.id}_${input.origin}_${input.destination}`,
      vendor: `Fixture / ${b.airline}`,
      airline: b.airline,
      airline_iata: b.iata,
      from: input.origin,
      to: input.destination,
      depart,
      arrive: `${arriveDate}T${String(arriveHour || 18).padStart(2, "0")}:20:00`,
      cabin: b.cabin,
      price_per_person: b.price,
      currency: "USD",
      tags: ["fixture", "rewritten-route", intl ? "long-haul" : "domestic"],
    };
  });
  if (input.max_price == null) return offers;
  const capped = offers.filter((o) => o.price_per_person <= input.max_price!);
  return capped.length ? capped : offers.sort((a, b) => a.price_per_person - b.price_per_person);
}

/**
 * Flight search — Duffel when keyed, else route-correct fixtures.
 * Never return hardcoded JFK→MIA when the user asked for another pair.
 */
export async function searchFlights(input: {
  origin?: string;
  destination?: string;
  depart_date?: string;
  /** If set, also search return leg (dest → origin) */
  return_date?: string;
  max_price?: number;
}): Promise<{
  offers: FlightOffer[];
  return_offers?: FlightOffer[];
  source: "duffel" | "fixture";
  return_source?: "duffel" | "fixture";
}> {
  const outbound = await searchFlightsOneWay({
    origin: input.origin,
    destination: input.destination,
    depart_date: input.depart_date,
    max_price: input.max_price,
  });
  if (!input.return_date?.trim()) {
    return outbound;
  }
  const inbound = await searchFlightsOneWay({
    origin: input.destination,
    destination: input.origin,
    depart_date: input.return_date,
    max_price: input.max_price,
  });
  return {
    offers: outbound.offers,
    return_offers: inbound.offers,
    source: outbound.source,
    return_source: inbound.source,
  };
}

async function searchFlightsOneWay(input: {
  origin?: string;
  destination?: string;
  depart_date?: string;
  max_price?: number;
}): Promise<{ offers: FlightOffer[]; source: "duffel" | "fixture" }> {
  const origin = (input.origin || "").toUpperCase();
  const destination = (input.destination || "").toUpperCase();
  const departDate = input.depart_date || "2026-08-14";

  if (!origin || !destination) {
    throw new Error("searchFlights requires origin and destination IATA codes");
  }

  if (hasDuffel()) {
    try {
      const res = await fetch("https://api.duffel.com/air/offer_requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
          "Content-Type": "application/json",
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin,
                destination,
                departure_date: departDate,
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
              owner?: { name?: string; iata_code?: string };
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
          const airline = o.owner?.name || "Airline";
          const iata =
            o.owner?.iata_code ||
            airlineIataFromName(airline) ||
            undefined;
          return {
            id: o.id,
            vendor: `Duffel / ${airline}`,
            airline,
            airline_iata: iata,
            from: seg?.originating_airport_iata_code || origin,
            to: seg?.destination_airport_iata_code || destination,
            depart: seg?.departing_at || `${departDate}T08:00:00`,
            arrive: seg?.arriving_at || `${departDate}T11:00:00`,
            cabin: seg?.passengers?.[0]?.cabin_class_marketing_name || "Economy",
            price_per_person: Number(o.total_amount || 199),
            currency: "USD",
            tags: ["live", "duffel"],
          };
        });
        if (offers.length) return { offers: offers.map(withIata), source: "duffel" };
      }
    } catch {
      // fall through
    }
  }

  // Prefer inventory that already matches; otherwise synthesize the asked route
  const matched = FLIGHT_INVENTORY.filter(
    (o) => o.from === origin && o.to === destination,
  );
  if (matched.length) {
    let offers = matched.map(withIata);
    if (input.max_price != null) {
      const capped = offers.filter((o) => o.price_per_person <= input.max_price!);
      offers = capped.length ? capped : offers;
    }
    return { offers, source: "fixture" };
  }

  return {
    offers: synthFixtures({
      origin,
      destination,
      departDate,
      max_price: input.max_price,
    }).map(withIata),
    source: "fixture",
  };
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
