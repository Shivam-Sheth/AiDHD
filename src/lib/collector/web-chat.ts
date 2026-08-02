import { randomUUID } from "crypto";
import { getUser } from "../demo-users";
import {
  airportCodeForPlace,
  displayCityForPlace,
} from "../geo/airports";
import {
  addResponse,
  clearCollector,
  getCollector,
  getEvent,
  listResponses,
  setCollector,
  upsertEvent,
} from "../store";
import type { Channel, ChatMessage, CollectorSession, Response } from "../types";
import { parseWhatsAppTurnWithGemini, type GeminiTurnParse } from "./gemini-parse";

function msg(role: "assistant" | "user", content: string): ChatMessage {
  return { id: randomUUID(), role, content, ts: new Date().toISOString() };
}

function parseBudget(text: string): number | null {
  const cleaned = text.toLowerCase().replace(/,/g, "");
  if (cleaned.includes("under") && cleaned.includes("80")) return 80;
  if (cleaned.includes("80") && cleaned.includes("120")) return 120;
  if (cleaned.includes("120") && cleaned.includes("200")) return 200;
  // Prefer patterns like "$150" / "150 dollars" over random years
  const dollar = cleaned.match(
    /(?:\$\s*|usd\s*)(\d{2,4})|(\d{2,4})\s*(?:dollars?|bucks|usd)\b/,
  );
  if (dollar) return Number(dollar[1] || dollar[2]);
  const n = cleaned.match(/\b(\d{2,4})\b/);
  return n ? Number(n[1]) : null;
}

function parseTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  for (const t of [
    "movie",
    "movies",
    "concert",
    "escape room",
    "escape",
    "lunch",
    "dinner",
    "brunch",
    "drinks",
    "alc",
    "alcohol",
    "no alc",
    "sober",
    "veg",
    "vegetarian",
    "vegan",
    "non veg",
    "non-veg",
    "chicken",
    "chill",
    "relax",
    "beach",
    "beachy",
    "nightlife",
    "quiet",
    "splurge",
    "vip",
    "seated",
    "standing",
  ]) {
    if (lower.includes(t)) tags.push(t.replace(/\s+/g, "_"));
  }
  return tags;
}

/** Pull budget + dates + vibe + place from one blob so we don't ignore extras. */
export function extractBundle(text: string): {
  budget: number | null;
  dates: string[];
  vibe: string | null;
  place: string | null;
} {
  const lower = text.toLowerCase();
  const budget = parseBudget(text);
  const dates = parseAvailability(text);

  let place: string | null = null;
  const placeMatch = lower.match(
    /\b(?:in|to|for|near)?\s*(new york|nyc|miami|chicago|la|los angeles|boston|atlanta|dallas|seattle|austin|denver|london|paris)\b/i,
  );
  if (placeMatch) place = placeMatch[1];

  // Vibe = leftover after stripping budget/date noise (keep if meaningful)
  let vibe = text
    .replace(/\$?\s*\d{2,4}\s*(dollars?|bucks|usd)?/gi, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\b/gi, " ")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, " ")
    .replace(/\b(to|from|and|but|also|works|dollars?|budget|st|nd|rd|th)\b/gi, " ")
    .replace(/[,\-–]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (place) {
    vibe = vibe.replace(new RegExp(place, "ig"), "").trim();
  }
  if (vibe.length < 3) vibe = "";
  // Prefer clean vibe keywords if present
  const vibeBits = [
    "beachy",
    "beach",
    "chill",
    "relax",
    "concert",
    "movie",
    "movies",
    "escape room",
    "lunch",
    "dinner",
    "brunch",
    "drinks",
    "alc",
    "veg",
    "vegetarian",
    "vegan",
    "non veg",
    "nightlife",
    "quiet",
    "splurge",
  ].filter((k) => lower.includes(k));
  if (vibeBits.length) vibe = vibeBits.join(", ");

  return { budget, dates, vibe: vibe || null, place };
}

export function parseAvailability(text: string): string[] {
  const lower = text.toLowerCase().replace(/,/g, " ");

  // Vague answers → empty so we re-ask for a concrete range (don't force Aug 7/8)
  if (
    /^(either|both|any|whenever|flexible|tbd|idk|dunno)[\s!.?]*$/i.test(
      lower.trim(),
    )
  ) {
    return [];
  }

  const months: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const yearMatch = lower.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : 2026;

  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // "aug 11-20" / "august 11 to 20" / "11th to 20th august"
  const namedRange = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–|through|until)\s*(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (namedRange) {
    const m = months[namedRange[1].slice(0, 3)] ?? months[namedRange[1]];
    const a = Number(namedRange[2]);
    const b = Number(namedRange[3]);
    if (m && a >= 1 && b <= 31 && a <= b) return [iso(year, m, a), iso(year, m, b)];
  }

  const namedRangeFlip = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–|through|until)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/,
  );
  if (namedRangeFlip) {
    const key = namedRangeFlip[3].slice(0, 3);
    const m = months[key] ?? months[namedRangeFlip[3]];
    const a = Number(namedRangeFlip[1]);
    const b = Number(namedRangeFlip[2]);
    if (m && a >= 1 && b <= 31 && a <= b) return [iso(year, m, a), iso(year, m, b)];
  }

  // Cross-month: "aug 28 to sep 2"
  const cross = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–|through|until)\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (cross) {
    const m1 = months[cross[1].slice(0, 3)] ?? months[cross[1]];
    const m2 = months[cross[3].slice(0, 3)] ?? months[cross[3]];
    const d1 = Number(cross[2]);
    const d2 = Number(cross[4]);
    if (m1 && m2) return [iso(year, m1, d1), iso(year, m2, d2)];
  }

  // ISO already
  const isos = [...lower.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
  if (isos.length >= 2) return [isos[0], isos[isos.length - 1]];
  if (isos.length === 1) return [isos[0]];

  // Numeric range without month: "11-20" alone is ambiguous — require month nearby or skip
  // Single named day: "aug 14"
  const single = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (single) {
    const m = months[single[1].slice(0, 3)] ?? months[single[1]];
    const d = Number(single[2]);
    if (m && d >= 1 && d <= 31) return [iso(year, m, d)];
  }

  // Weekend shorthand still ok if they explicitly say it
  if (/\bthis weekend\b|\bnext weekend\b|\bweekend\b/.test(lower)) {
    // Demo-friendly default weekend window — only when they ask for "weekend"
    return [iso(year, 8, 7), iso(year, 8, 9)];
  }

  return [];
}

function destCityForPlace(place: string): string {
  return displayCityForPlace(place);
}

/** Resolve IATA or null — never invent JFK. */
function resolveAirportOrNull(place: string): string | null {
  return airportCodeForPlace(place);
}

const DATE_PROMPT =
  "What date range works? (e.g. Aug 11–20, Sep 5–7, or Aug 28 to Sep 2)";

const VIBE_PROMPT =
  "Vibe prefs? (e.g. movie, escape room, lunch/dinner, veg, alc, chill)";

export const MODE_CHECKLIST_OUTING = `I'll need from you:
1) Budget
2) Date range that works
3) Vibe prefs (activity / food / drinks)

Let's start with budget — what's your cap? (e.g. 120)`;

export const MODE_CHECKLIST_TRIP = `I'll need from you:
1) Budget
2) Current city + country (for flights)
3) Destination
4) Date range that works
5) Optional — activities in the destination (movie, dinner, concert) or SKIP

Let's start with budget — what's your cap for the trip? (e.g. 400)`;

const TRIP_ACTIVITY_PROMPT =
  "Optional: any activities in the destination? (e.g. movie, concert, dinner) — or reply SKIP for flights + hotel only";

export function startCollector(
  eventId: string,
  userId: string,
  opts?: { channel?: Channel; name?: string; force?: boolean },
): CollectorSession {
  if (opts?.force) clearCollector(eventId, userId);
  const existing = getCollector(eventId, userId);
  if (existing) return existing;

  const event = getEvent(eventId);
  const user = getUser(userId);
  const channel = opts?.channel ?? user?.channel ?? "web";
  const name = opts?.name ?? user?.name ?? "there";
  const isTrip = event?.type === "trip";
  const session: CollectorSession = {
    user_id: userId,
    event_id: eventId,
    channel,
    step: "budget",
    draft: {
      event_id: eventId,
      user_id: userId,
      channel,
      budget_currency: "USD",
    },
    messages:
      channel === "whatsapp"
        ? [
            msg(
              "assistant",
              isTrip ? MODE_CHECKLIST_TRIP : MODE_CHECKLIST_OUTING,
            ),
          ]
        : [
            msg(
              "assistant",
              `Hey ${name} — collecting for "${event?.title ?? "the plan"}". ${
                isTrip
                  ? "Budget → origin → destination → dates → YES (flights + hotel)."
                  : "Budget → dates → vibe → YES."
              }`,
            ),
            msg(
              "assistant",
              "What's your budget cap? (e.g. 80, 120, 200, 400)",
            ),
          ],
  };
  setCollector(session);
  return session;
}

function tripConfirmPrompt(session: CollectorSession): string {
  const prefs = session.draft.preferences ?? {
    free_text: "flights + hotel",
    structured_tags: [],
  };
  const activity =
    prefs.free_text && prefs.free_text !== "flights + hotel"
      ? prefs.free_text
      : session.draft.pending_vibe || "flights + hotel only";
  session.draft.preferences = {
    ...prefs,
    free_text:
      prefs.free_text && prefs.free_text !== "flights + hotel"
        ? prefs.free_text
        : session.draft.pending_vibe
          ? `flights + hotel · ${session.draft.pending_vibe}`
          : "flights + hotel",
  };
  session.step = "confirm";
  const dates = session.draft.availability?.length
    ? session.draft.availability.length === 1
      ? session.draft.availability[0]
      : `${session.draft.availability[0]} → ${session.draft.availability[session.draft.availability.length - 1]}`
    : "?";
  return (
    `Confirm trip?\n` +
    `$${session.draft.budget_cap} · ${dates}\n` +
    `· From: ${prefs.origin_city ?? "?"} (${prefs.origin_country ?? "?"})\n` +
    `· To: ${prefs.destination ?? "?"}\n` +
    `· Route: ${
      prefs.structured_tags.find((t) => t.startsWith("origin:"))?.slice(7) ?? "?"
    }→${
      prefs.structured_tags.find((t) => t.startsWith("dest:"))?.slice(5) ?? "?"
    }\n` +
    `· Activities: ${activity}\n` +
    `Reply YES`
  );
}

function askNextAfterBudget(session: CollectorSession): string {
  const event = getEvent(session.event_id);
  const isTrip = event?.type === "trip";
  if (isTrip) {
    session.step = "origin";
    return `Got $${session.draft.budget_cap}. What's your current city and country? (for flights — e.g. New York, USA)`;
  }
  if (session.draft.availability?.length) {
    session.step = "preferences";
    const pending = [session.draft.pending_vibe, session.draft.pending_place]
      .filter(Boolean)
      .join(" · ");
    return pending
      ? `Dates noted (${session.draft.availability.join(" → ")}). ${VIBE_PROMPT} I already have: ${pending} — add more or reply OK`
      : `Dates noted (${session.draft.availability.join(" → ")}). ${VIBE_PROMPT}`;
  }
  session.step = "availability";
  return `Got $${session.draft.budget_cap}. ${DATE_PROMPT}`;
}

export async function handleCollectorMessage(
  eventId: string,
  userId: string,
  text: string,
): Promise<{ session: CollectorSession; response?: Response; allIn: boolean }> {
  const session = getCollector(eventId, userId) ?? startCollector(eventId, userId);
  session.messages.push(msg("user", text));
  const event = getEvent(eventId);
  const isTrip = event?.type === "trip";

  const gemini = await parseWhatsAppTurnWithGemini({
    text,
    step: session.step === "done" ? "done" : session.step,
    eventType: event?.type,
  });

  if (session.step === "budget") {
    const bundle = extractBundle(text);
    const budget = gemini?.budget ?? bundle.budget;
    const dates =
      gemini?.dates?.length ? gemini.dates : bundle.dates;
    const vibe = gemini?.vibe || bundle.vibe;
    const place = gemini?.place || bundle.place;

    if (budget == null) {
      session.messages.push(
        msg(
          "assistant",
          gemini?.ask ||
            "Couldn't parse a budget — try something like 120 or 400 dollars.",
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.budget_cap = budget;
    if (dates.length) session.draft.availability = dates;
    if (vibe) session.draft.pending_vibe = vibe;
    if (place) {
      session.draft.pending_place = place;
      if (isTrip) {
        session.draft.preferences = {
          ...(session.draft.preferences ?? {
            free_text: "",
            structured_tags: [],
          }),
          free_text: session.draft.preferences?.free_text ?? "",
          structured_tags: session.draft.preferences?.structured_tags ?? [],
          destination:
            gemini?.destination || destCityForPlace(place),
        };
      }
    }
    if (gemini?.destination && isTrip) {
      const prefs = session.draft.preferences ?? {
        free_text: "",
        structured_tags: [],
      };
      session.draft.preferences = {
        ...prefs,
        destination: gemini.destination,
      };
    }
    if (gemini?.origin_city && isTrip) {
      const prefs = session.draft.preferences ?? {
        free_text: "",
        structured_tags: [],
      };
      const originIata = resolveAirportOrNull(gemini.origin_city);
      session.draft.preferences = {
        ...prefs,
        origin_city: gemini.origin_city,
        origin_country: gemini.origin_country || "USA",
        structured_tags: [
          ...new Set([
            ...prefs.structured_tags,
            ...(originIata ? [`origin:${originIata}`] : []),
            `origin_city:${gemini.origin_city}`,
          ]),
        ],
      };
    }
    const next = askNextAfterBudget(session);
    session.messages.push(msg("assistant", next));
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "origin") {
    const city =
      gemini?.origin_city ||
      text.split(",")[0]?.trim() ||
      text.trim();
    const country =
      gemini?.origin_country ||
      text.split(",")[1]?.trim() ||
      "USA";
    if (!city || city.length < 2) {
      session.messages.push(
        msg(
          "assistant",
          gemini?.ask || "City + country? e.g. Chicago, USA",
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    const originIata = resolveAirportOrNull(city);
    if (!originIata) {
      session.messages.push(
        msg(
          "assistant",
          `Couldn't map "${city}" to an airport. Try a major city (e.g. Chicago, New York, Miami) or an IATA code like ORD.`,
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    const prefs = session.draft.preferences ?? {
      free_text: "",
      structured_tags: [],
    };
    session.draft.preferences = {
      ...prefs,
      origin_city: displayCityForPlace(city),
      origin_country: country,
      structured_tags: [
        ...new Set([
          ...prefs.structured_tags,
          `origin:${originIata}`,
          `origin_city:${displayCityForPlace(city)}`,
        ]),
      ],
      destination: gemini?.destination || prefs.destination,
    };
    if (gemini?.dates?.length) session.draft.availability = gemini.dates;

    if (session.draft.preferences.destination) {
      if (session.draft.availability?.length) {
        session.step = "preferences";
        session.messages.push(
          msg(
            "assistant",
            `Flying from ${displayCityForPlace(city)} (${originIata}), ${country} → ${session.draft.preferences.destination}. Dates locked. ${TRIP_ACTIVITY_PROMPT}`,
          ),
        );
      } else {
        session.step = "availability";
        session.messages.push(
          msg(
            "assistant",
            `Flying from ${displayCityForPlace(city)} (${originIata}), ${country} → ${session.draft.preferences.destination}. ${DATE_PROMPT}`,
          ),
        );
      }
    } else {
      session.step = "destination";
      session.messages.push(
        msg(
          "assistant",
          `Got it — departing ${displayCityForPlace(city)} (${originIata}), ${country}. Where do you want to go? (e.g. New York)`,
        ),
      );
    }
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "destination") {
    const dest = (gemini?.destination || text.trim()).trim();
    if (dest.length < 2) {
      session.messages.push(
        msg("assistant", gemini?.ask || "Destination? e.g. New York"),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    const destIata = resolveAirportOrNull(dest);
    if (!destIata) {
      session.messages.push(
        msg(
          "assistant",
          `Couldn't map "${dest}" to an airport. Try New York, Miami, Chicago, or an IATA code like JFK.`,
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    const prefs = session.draft.preferences ?? {
      free_text: "",
      structured_tags: [],
    };
    const city = destCityForPlace(dest);
    const originIata = prefs.structured_tags
      .find((t) => t.startsWith("origin:"))
      ?.slice("origin:".length);
    if (originIata && originIata === destIata) {
      session.messages.push(
        msg(
          "assistant",
          `That's the same as your origin (${originIata}). Pick a different destination city.`,
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.preferences = {
      ...prefs,
      destination: city,
      structured_tags: [
        ...new Set([
          ...prefs.structured_tags,
          `dest:${destIata}`,
          `destination:${city}`,
        ]),
      ],
    };
    if (gemini?.dates?.length) session.draft.availability = gemini.dates;

    if (session.draft.availability?.length) {
      session.step = "preferences";
      session.messages.push(
        msg(
          "assistant",
          `Destination ${city} (${destIata}). Dates locked. ${TRIP_ACTIVITY_PROMPT}`,
        ),
      );
    } else {
      session.step = "availability";
      session.messages.push(
        msg(
          "assistant",
          `Destination ${city} (${destIata}). ${DATE_PROMPT}`,
        ),
      );
    }
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "availability") {
    const uniq =
      gemini?.dates?.length ? gemini.dates : parseAvailability(text);
    if (!uniq.length) {
      const saidVague =
        /^(either|both|any|whenever|flexible|tbd|idk|dunno)[\s!.?]*$/i.test(
          text.trim(),
        ) || /either|any\/flexible|flexible/i.test(gemini?.ask || "");
      session.messages.push(
        msg(
          "assistant",
          saidVague
            ? `Need a concrete date range — not just "either/any".\n${DATE_PROMPT}`
            : gemini?.ask && !/either/i.test(gemini.ask)
              ? gemini.ask
              : `Couldn't parse those dates. ${DATE_PROMPT}`,
        ),
      );
      setCollector(session);
      return { session, allIn: false };
    }
    session.draft.availability = uniq;
    if (gemini?.vibe) session.draft.pending_vibe = gemini.vibe;
    if (gemini?.place) session.draft.pending_place = gemini.place;

    // Trips: optional destination activities, then confirm
    if (isTrip) {
      if (session.draft.pending_vibe) {
        const prefs = session.draft.preferences ?? {
          free_text: "",
          structured_tags: [],
        };
        session.draft.preferences = {
          ...prefs,
          free_text: `flights + hotel · ${session.draft.pending_vibe}`,
          structured_tags: [
            ...new Set([
              ...prefs.structured_tags,
              ...parseTags(session.draft.pending_vibe),
            ]),
          ],
        };
        session.messages.push(msg("assistant", tripConfirmPrompt(session)));
      } else {
        session.step = "preferences";
        const pretty =
          uniq.length === 1 ? uniq[0] : `${uniq[0]} → ${uniq[uniq.length - 1]}`;
        session.messages.push(
          msg(
            "assistant",
            `Date range locked (${pretty}). ${TRIP_ACTIVITY_PROMPT}`,
          ),
        );
      }
      setCollector(session);
      return { session, allIn: false };
    }

    session.step = "preferences";
    const pending = [session.draft.pending_vibe, session.draft.pending_place]
      .filter(Boolean)
      .join(" · ");
    const pretty =
      uniq.length === 1 ? uniq[0] : `${uniq[0]} → ${uniq[uniq.length - 1]}`;
    session.messages.push(
      msg(
        "assistant",
        pending
          ? `Date range locked (${pretty}). ${VIBE_PROMPT} I already noted: ${pending} — add more or reply OK`
          : `Date range locked (${pretty}). ${VIBE_PROMPT}`,
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "preferences") {
    const lower = text.trim().toLowerCase();
    if (isTrip) {
      const skip =
        /^(skip|no|none|nah|flights?\s*\+?\s*hotels?|just flights?)[\s!.?]*$/i.test(
          lower,
        );
      const prefs = session.draft.preferences ?? {
        free_text: "",
        structured_tags: [],
      };
      if (skip) {
        session.draft.preferences = {
          ...prefs,
          free_text: "flights + hotel",
        };
      } else {
        const free =
          gemini?.vibe ||
          text.trim() ||
          session.draft.pending_vibe ||
          "flights + hotel";
        session.draft.preferences = {
          ...prefs,
          free_text: `flights + hotel · ${free}`,
          structured_tags: [
            ...new Set([...prefs.structured_tags, ...parseTags(free)]),
          ],
        };
      }
      session.messages.push(msg("assistant", tripConfirmPrompt(session)));
      setCollector(session);
      return { session, allIn: false };
    }
    const usePending =
      (/^(ok|okay|same|yes|y)$/i.test(lower) ||
        gemini?.intent === "confirm_yes") &&
      session.draft.pending_vibe;
    const free = usePending
      ? [session.draft.pending_vibe, session.draft.pending_place]
          .filter(Boolean)
          .join(" · ")
      : [
          gemini?.vibe || text,
          session.draft.pending_vibe,
          session.draft.pending_place,
        ]
          .filter(Boolean)
          .join(" · ");
    const prefs = session.draft.preferences ?? {
      free_text: "",
      structured_tags: [],
    };
    session.draft.preferences = {
      ...prefs,
      free_text: free,
      structured_tags: [
        ...new Set([...prefs.structured_tags, ...parseTags(free)]),
      ],
    };
    session.step = "confirm";
    session.messages.push(
      msg(
        "assistant",
        session.channel === "whatsapp"
          ? `Confirm?\n$${session.draft.budget_cap} · ${session.draft.availability?.join(", ")}\n· ${free}\nReply YES`
          : `Confirm submit?\n• Budget: $${session.draft.budget_cap}\n• Nights: ${session.draft.availability?.join(", ")}\n• Prefs: ${free}\n\nReply YES to submit.`,
      ),
    );
    setCollector(session);
    return { session, allIn: false };
  }

  if (session.step === "confirm") {
    const yes =
      gemini?.intent === "confirm_yes" ||
      /^(y|yes|yeah|yep|sure|ok|okay|confirm)\b/i.test(text.trim());
    if (!yes) {
      if (isTrip) {
        session.step = "preferences";
        session.messages.push(
          msg(
            "assistant",
            `No problem — ${TRIP_ACTIVITY_PROMPT}`,
          ),
        );
      } else {
        session.step = "preferences";
        session.messages.push(
          msg(
            "assistant",
            "No problem — rewrite your vibe prefs and I'll reconfirm.",
          ),
        );
      }
      setCollector(session);
      return { session, allIn: false };
    }

    if (!session.draft.preferences) {
      session.draft.preferences = {
        free_text: isTrip ? "flights + hotel" : "",
        structured_tags: [],
      };
    }

    const response = addResponse({
      event_id: eventId,
      user_id: userId,
      channel: session.channel,
      budget_cap: session.draft.budget_cap!,
      budget_currency: "USD",
      preferences: session.draft.preferences!,
      availability: session.draft.availability!,
    });

    session.step = "done";
    session.messages.push(
      msg(
        "assistant",
        "Submitted. Once the whole group responds, AiDHD will reconcile packages.",
      ),
    );
    setCollector(session);

    const live = getEvent(eventId);
    const responses = listResponses(eventId);
    const allIn = Boolean(
      live && responses.length >= live.invitee_ids.length,
    );
    if (allIn && live && live.status === "collecting") {
      upsertEvent({ ...live, status: "reconciling" });
    }

    return { session, response, allIn };
  }

  session.messages.push(msg("assistant", "You're already submitted for this event."));
  setCollector(session);
  return { session, allIn: listResponses(eventId).length >= 3 };
}

/** Fast Gemini (+ regex fallback) for WhatsApp top-level intents. */
export async function classifyWhatsAppIntent(
  text: string,
): Promise<GeminiTurnParse | null> {
  return parseWhatsAppTurnWithGemini({
    text,
    step: "idle",
  });
}
