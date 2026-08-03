import {
  FLIGHT_INVENTORY,
  type FlightOffer,
} from "../merchants/fixtures";
import { airlineIataFromName } from "../geo/airlines";
import { hasDuffel } from "./config";

type DuffelPlace = {
  iata_code?: string;
  city_name?: string;
  name?: string;
  city?: { name?: string; city_name?: string };
};

type DuffelSegment = {
  origin?: DuffelPlace;
  destination?: DuffelPlace;
  originating_airport_iata_code?: string;
  destination_airport_iata_code?: string;
  departing_at?: string;
  arriving_at?: string;
  duration?: string;
  stops?: unknown[];
  marketing_carrier_flight_number?: string;
  marketing_carrier?: {
    name?: string;
    iata_code?: string;
    logo_symbol_url?: string;
  };
  operating_carrier?: {
    name?: string;
    iata_code?: string;
    logo_symbol_url?: string;
  };
  passengers?: Array<{
    cabin_class_marketing_name?: string;
    cabin_class?: string;
  }>;
};

function withIata(o: FlightOffer): FlightOffer {
  return {
    ...o,
    airline_iata: o.airline_iata || airlineIataFromName(o.airline) || undefined,
  };
}

function fmtDuration(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return iso;
  const h = m[1] ? `${m[1]}h` : "";
  const min = m[2] ? `${m[2]}m` : "";
  return `${h}${h && min ? " " : ""}${min}` || undefined;
}

function placeCode(p?: DuffelPlace, fallback?: string): string {
  return (p?.iata_code || fallback || "").toUpperCase();
}

function placeCity(p?: DuffelPlace): string | undefined {
  return (
    p?.city_name ||
    p?.city?.city_name ||
    p?.city?.name ||
    p?.name ||
    undefined
  );
}

function synthFixtures(input: {
  origin: string;
  destination: string;
  departDate: string;
  max_price?: number;
}): FlightOffer[] {
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
 * Backup when Duffel empty/fails: curated fixtures + Google Flights deep link (no public Skyscanner API).
 */
export async function searchFlights(input: {
  origin?: string;
  destination?: string;
  depart_date?: string;
  return_date?: string;
  max_price?: number;
  /** Adults on the offer (one Duffel order later). Default 1. */
  passengers?: number;
}): Promise<{
  offers: FlightOffer[];
  return_offers?: FlightOffer[];
  source: "duffel" | "fixture";
  return_source?: "duffel" | "fixture";
}> {
  const passengers = Math.min(9, Math.max(1, Math.floor(input.passengers || 1)));
  const outbound = await searchFlightsOneWay({
    origin: input.origin,
    destination: input.destination,
    depart_date: input.depart_date,
    max_price: input.max_price,
    passengers,
  });
  if (!input.return_date?.trim()) {
    return outbound;
  }
  const inbound = await searchFlightsOneWay({
    origin: input.destination,
    destination: input.origin,
    depart_date: input.return_date,
    max_price: input.max_price,
    passengers,
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
  passengers?: number;
}): Promise<{ offers: FlightOffer[]; source: "duffel" | "fixture" }> {
  const origin = (input.origin || "").toUpperCase();
  const destination = (input.destination || "").toUpperCase();
  const departDate = input.depart_date || "2026-08-14";
  const passengerCount = Math.min(9, Math.max(1, Math.floor(input.passengers || 1)));

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
            passengers: Array.from({ length: passengerCount }, () => ({
              type: "adult",
            })),
            cabin_class: "economy",
          },
        }),
      });
      if (!res.ok) {
        console.error("[duffel] offer_requests", res.status, await res.text());
      } else {
        const json = (await res.json()) as {
          data?: {
            offers?: Array<{
              id: string;
              total_amount?: string;
              total_currency?: string;
              owner?: {
                name?: string;
                iata_code?: string;
                logo_symbol_url?: string;
              };
              /** Echoed from the offer_request — required unchanged in /air/orders' passengers[].id. */
              passengers?: Array<{ id?: string }>;
              slices?: Array<{
                duration?: string;
                segments?: DuffelSegment[];
              }>;
            }>;
          };
        };
        const offers: FlightOffer[] = (json.data?.offers ?? [])
          .slice(0, 6)
          .map((o) => {
            const segs = o.slices?.[0]?.segments || [];
            const first = segs[0];
            const last = segs[segs.length - 1] || first;
            const carrier = first?.marketing_carrier || o.owner;
            const airline = carrier?.name || o.owner?.name || "Airline";
            const iata =
              carrier?.iata_code ||
              o.owner?.iata_code ||
              airlineIataFromName(airline) ||
              undefined;
            const flightNo = first?.marketing_carrier_flight_number
              ? `${iata || ""}${first.marketing_carrier_flight_number}`
              : undefined;
            return {
              id: o.id,
              vendor: `Duffel / ${airline}`,
              airline,
              airline_iata: iata,
              airline_logo_url:
                carrier?.logo_symbol_url || o.owner?.logo_symbol_url,
              flight_number: flightNo,
              duration: fmtDuration(o.slices?.[0]?.duration || first?.duration),
              stops: Math.max(0, segs.length - 1),
              from:
                placeCode(first?.origin, first?.originating_airport_iata_code) ||
                origin,
              from_city: placeCity(first?.origin),
              to:
                placeCode(
                  last?.destination,
                  last?.destination_airport_iata_code,
                ) || destination,
              to_city: placeCity(last?.destination),
              depart: first?.departing_at || `${departDate}T08:00:00`,
              arrive: last?.arriving_at || `${departDate}T11:00:00`,
              cabin:
                first?.passengers?.[0]?.cabin_class_marketing_name ||
                first?.passengers?.[0]?.cabin_class ||
                "Economy",
              price_per_person: Number(o.total_amount || 199),
              currency: o.total_currency || "USD",
              tags: ["live", "duffel"],
            };
          });
        if (offers.length) {
          return { offers: offers.map(withIata), source: "duffel" };
        }
      }
    } catch (err) {
      console.error("[duffel] search failed", err);
    }
  }

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

export type BookFlightResult =
  | {
      ok: true;
      confirmation_id: string;
      mode: "duffel" | "duffel-sandbox-fallback" | "fixture";
      order_id?: string;
      booking_reference?: string;
    }
  | {
      ok: false;
      failure_reason: string;
      mode?: "duffel" | "fixture";
    };

/**
 * Real booking path: vault passport → Duffel Orders (test/live key).
 * Never call from the LLM with plaintext — pass user_id only.
 */
export async function bookFlightWithVault(input: {
  offerId: string;
  userId: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  phone?: string;
  /** YYYY-MM-DD — Duffel requires DOB; demo default if missing */
  bornOn?: string;
  gender?: "m" | "f";
  /** One-time override from PassportGate — never log / never send to LLM */
  passportPlaintext?: string;
}): Promise<BookFlightResult> {
  return bookGroupFlightWithVault({
    offerId: input.offerId,
    passengers: [
      {
        userId: input.userId,
        email: input.email,
        givenName: input.givenName,
        familyName: input.familyName,
        phone: input.phone,
        bornOn: input.bornOn,
        gender: input.gender,
        passportPlaintext: input.passportPlaintext,
      },
    ],
  });
}

/**
 * One Duffel order, N vault passports. Numbers never leave the server / never enter chat.
 */
export async function bookGroupFlightWithVault(input: {
  offerId: string;
  passengers: Array<{
    userId: string;
    email?: string;
    givenName?: string;
    familyName?: string;
    phone?: string;
    bornOn?: string;
    gender?: "m" | "f";
    passportPlaintext?: string;
  }>;
}): Promise<BookFlightResult> {
  const {
    peekPassportPlaintext,
    getTraveler,
    consumeOncePassports,
  } = await import("../vault/traveler-store");

  if (!input.passengers.length) {
    return { ok: false, failure_reason: "Need at least one passenger." };
  }

  type BuiltPax = {
    userId: string;
    givenName: string;
    familyName: string;
    email: string;
    phone: string;
    bornOn: string;
    gender: "m" | "f";
    passport: string;
  };

  const built: BuiltPax[] = [];
  for (const p of input.passengers) {
    const passport =
      p.passportPlaintext?.trim() || (await peekPassportPlaintext(p.userId));
    if (!passport) {
      return {
        ok: false,
        failure_reason: `Passport missing for traveler ${p.userId.slice(0, 8)}. Send their private passport link — never ask in chat.`,
      };
    }
    const traveler = await getTraveler(p.userId);
    const display = traveler?.display_name || "Traveler Guest";
    const parts = display.trim().split(/\s+/);
    built.push({
      userId: p.userId,
      givenName: p.givenName || parts[0] || "Traveler",
      familyName:
        p.familyName ||
        (parts.length > 1 ? parts.slice(1).join(" ") : "Guest"),
      email: p.email || traveler?.email || `${p.userId.slice(0, 8)}@aidhd.app`,
      phone: p.phone || traveler?.phone || "+13125550100",
      bornOn: p.bornOn || "1995-06-15",
      gender: p.gender || "m",
      passport,
    });
  }

  // Fixture / non-Duffel offer ids — mock confirm after vault check
  if (!hasDuffel() || !input.offerId.startsWith("off_")) {
    consumeOncePassports(built.map((b) => b.userId));
    return {
      ok: true,
      confirmation_id: `AIDHD-FLT-${Date.now().toString(36).toUpperCase()}`,
      mode: hasDuffel() ? "duffel-sandbox-fallback" : "fixture",
    };
  }

  try {
    const offerRes = await fetch(
      `https://api.duffel.com/air/offers/${encodeURIComponent(input.offerId)}?return_available_services=false`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
      },
    );
    if (!offerRes.ok) {
      const t = await offerRes.text();
      return {
        ok: false,
        mode: "duffel",
        failure_reason: `Offer expired or invalid (${offerRes.status}). Search again. ${t.slice(0, 180)}`,
      };
    }
    const offerJson = (await offerRes.json()) as {
      data?: {
        id?: string;
        total_amount?: string;
        total_currency?: string;
        passengers?: Array<{ id: string }>;
      };
    };
    const offerPax = offerJson.data?.passengers || [];
    const amount = offerJson.data?.total_amount;
    const currency = offerJson.data?.total_currency || "USD";
    if (!amount || offerPax.length < built.length) {
      return {
        ok: false,
        mode: "duffel",
        failure_reason: `Offer has ${offerPax.length} passenger slot(s) but booking needs ${built.length}. Re-search with passengers=${built.length}.`,
      };
    }

    const orderPassengers = built.map((b, i) => {
      const phone = b.phone.startsWith("+") ? b.phone : `+${b.phone}`;
      return {
        id: offerPax[i]!.id,
        given_name: b.givenName,
        family_name: b.familyName,
        born_on: b.bornOn,
        gender: b.gender,
        title: b.gender === "f" ? "ms" : "mr",
        email: b.email,
        phone_number: phone,
        identity_documents: [
          {
            type: "passport",
            unique_identifier: b.passport,
            expires_on: "2032-12-31",
            issuing_country_code: "US",
          },
        ],
      };
    });

    const orderRes = await fetch("https://api.duffel.com/air/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
        "Content-Type": "application/json",
        "Duffel-Version": "v2",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "instant",
          selected_offers: [input.offerId],
          passengers: orderPassengers,
          payments: [
            {
              type: "balance",
              amount,
              currency,
            },
          ],
        },
      }),
    });

    const orderText = await orderRes.text();
    let orderData: {
      data?: {
        id?: string;
        booking_reference?: string;
        confirmation_code?: string;
      };
      errors?: Array<{ message?: string; title?: string }>;
    } = {};
    try {
      orderData = JSON.parse(orderText) as typeof orderData;
    } catch {
      /* raw */
    }

    if (!orderRes.ok) {
      const errMsg =
        orderData.errors?.[0]?.message ||
        orderData.errors?.[0]?.title ||
        orderText.slice(0, 220);
      return {
        ok: false,
        mode: "duffel",
        failure_reason: `Duffel order failed: ${errMsg}. Ensure test balance / offer still valid. Vault passports stayed server-side (not in chat).`,
      };
    }

    consumeOncePassports(built.map((b) => b.userId));

    const confirmation =
      orderData.data?.booking_reference ||
      orderData.data?.id ||
      `DUFFEL-${Date.now().toString(36).toUpperCase()}`;

    return {
      ok: true,
      confirmation_id: confirmation,
      order_id: orderData.data?.id,
      booking_reference: orderData.data?.booking_reference,
      mode: "duffel",
    };
  } catch (e) {
    return {
      ok: false,
      mode: "duffel",
      failure_reason: e instanceof Error ? e.message : "Duffel book failed",
    };
  }
}
