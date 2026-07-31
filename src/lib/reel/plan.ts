import { searchFlights } from "../integrations/flights";
import { searchHotels } from "../integrations/hotels";
import { searchTickets } from "../integrations/ticketmaster";
import { airportCodeForPlace } from "../geo/airports";
import { airlineIataFromName, airlineLogoUrl } from "../geo/airlines";
import { reelSourceFromUrl } from "./detect";
import { decodeReelWithGemini } from "./decode";
import { resolveTripDates } from "./dates";
import { fetchReelCaption } from "./fetch-meta";
import { buildEnrichedItinerary } from "./itinerary";
import { budgetFromCaption } from "./heuristic";
import { extractVisualTextFromReel } from "./vision";
import type {
  ReelBrief,
  ReelClarifyAsk,
  ReelFlightOption,
  ReelHotelOption,
  ReelItineraryDay,
  ReelPlanResult,
  ReelTicketOption,
} from "./types";

export type ReelPlanInput = {
  url?: string | null;
  transcript?: string;
  caption?: string;
  /** Skip Instagram re-fetch when client already has caption from preview */
  cached_caption?: string;
  party_size?: number;
  selected_date?: string;
  /** Freeform range when reel has no concrete dates — e.g. "Aug 10-15" */
  date_range?: string;
  selected_time?: string;
  budget_cap?: number;
  origin_city?: string;
  /**
   * preview = read reel + asks only (light)
   * finalize = prefs in → itinerary + flights/hotels
   */
  stage?: "preview" | "finalize" | "auto";
  /**
   * When true, still return itinerary + asks, but don't require answers to
   * mark ready_to_book. Frontend should NOT set this if it wants questions.
   */
  relaxed?: boolean;
};

function buildAsks(
  brief: ReelBrief,
  input: ReelPlanInput,
): ReelClarifyAsk[] {
  const asks: ReelClarifyAsk[] = [];

  const party = input.party_size ?? brief.party_size_hint ?? null;
  if (!input.party_size) {
    asks.push({
      field: "party_size",
      prompt: party
        ? `Confirm party size (reel suggests ${party}) — how many people? Rooms scale with this.`
        : "How many people are going? (needed for rooms / tickets)",
      options: ["1", "2", "3", "4", "5", "6"],
    });
  }

  const dates = brief.dates.length
    ? brief.dates
    : brief.events.flatMap((e) => e.dates ?? []);
  const uniqDates = [...new Set(dates)];

  if (!input.selected_date && !input.date_range) {
    if (uniqDates.length > 1) {
      asks.push({
        field: "date_pick",
        prompt: "Which of these dates from the reel works?",
        options: uniqDates,
      });
    } else if (uniqDates.length === 1) {
      asks.push({
        field: "date_pick",
        prompt: `Use ${uniqDates[0]} from the reel, or pick another?`,
        options: [uniqDates[0]!, "other"],
      });
    } else {
      asks.push({
        field: "date_range",
        prompt:
          brief.days != null
            ? `The reel looks like ~${brief.days} days — what dates work? (e.g. Aug 10–15)`
            : "What dates work for this trip? (e.g. Aug 10–15 or 2026-08-10)",
      });
    }
  }

  if (brief.mode === "trip" && !brief.origin_city && !input.origin_city) {
    asks.push({
      field: "origin",
      prompt: "Flying from which city? (for flights)",
    });
  }

  const times = [
    ...new Set(brief.events.flatMap((e) => e.times ?? []).filter(Boolean)),
  ] as string[];
  if (
    (uniqDates.length === 1 || input.selected_date) &&
    times.length > 1 &&
    !input.selected_time
  ) {
    asks.push({
      field: "time_pick",
      prompt: "Which time?",
      options: times,
    });
  }

  return asks;
}

function wantsTicketmaster(brief: ReelBrief): boolean {
  if (!brief.ticket_keywords.length && !brief.events.length) return false;
  if (brief.mode === "trip") {
    const city = (brief.city || "").toLowerCase();
    const intl =
      /bali|india|europe|paris|tokyo|bangkok|dubai|mexico|canada|london|rome|singapore|vietnam|thailand|indonesia/.test(
        city,
      ) ||
      /bali|₹|inr|klook|airbnb villa/i.test(brief.transcript_or_caption);
    if (intl) return false;
  }
  return true;
}

function formatBudget(brief: ReelBrief): string | null {
  const cur = brief.budget_currency || "USD";
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : `${cur} `;
  if (brief.budget_note) return `Budget · ${brief.budget_note}`;
  if (brief.budget_cap != null) {
    const pp = `${sym}${Math.round(brief.budget_cap)}/pp`;
    if (brief.budget_total != null && brief.party_size_hint) {
      return `Budget · ${pp} · ${sym}${Math.round(brief.budget_total)} for ${brief.party_size_hint}`;
    }
    return `Budget · ${pp}`;
  }
  if (brief.budget_total != null) {
    return `Budget · ${sym}${Math.round(brief.budget_total)} total`;
  }
  return null;
}

/**
 * Always derive ₹/$ pp from the uploaded reel caption (not guesses).
 * If the user picks a different party size, scale group total = reel_pp × party.
 */
function applyBudgetFromReel(
  brief: ReelBrief,
  caption: string,
  partySize?: number,
): void {
  const fromReel = budgetFromCaption(caption);
  if (fromReel.budget_cap != null || fromReel.budget_total != null) {
    brief.budget_currency = fromReel.budget_currency;
    brief.budget_cap = fromReel.budget_cap;
    brief.budget_total = fromReel.budget_total;
    brief.budget_note = fromReel.budget_note ?? null;
    if (fromReel.party_size_hint != null) {
      brief.party_size_hint = fromReel.party_size_hint;
    }
  }

  const party = partySize ?? brief.party_size_hint ?? null;
  if (brief.budget_cap != null && party && party > 0) {
    brief.budget_total = Math.round(brief.budget_cap * party);
    if (partySize) brief.party_size_hint = partySize;
    const sym = brief.budget_currency === "INR" ? "₹" : "$";
    const pp = Math.round(brief.budget_cap);
    brief.budget_note =
      fromReel.budget_note ||
      `${sym}${pp.toLocaleString("en-IN")}/pp from reel`;
    if (partySize && fromReel.party_size_hint && partySize !== fromReel.party_size_hint) {
      brief.budget_note = `${fromReel.budget_note || `${sym}${pp}/pp`} · your group ${party} → ${sym}${Math.round(brief.budget_total).toLocaleString("en-IN")} total`;
    }
  }
}

function formatWhatsApp(
  result: Omit<ReelPlanResult, "whatsapp_message" | "cached_caption">,
): string {
  const lines: string[] = [
    `Reel plan: ${result.brief.title}`,
    result.brief.summary,
  ];
  if (result.brief.city) lines.push(`City: ${result.brief.city}`);
  const bud = formatBudget(result.brief);
  if (bud) lines.push(bud);
  if (result.flights.length) {
    lines.push("");
    lines.push("Flights:");
    for (const f of result.flights.slice(0, 3)) {
      lines.push(
        `· ${f.airline} ${f.from}→${f.to} · $${Math.round(f.price_per_person)}/pp`,
      );
    }
  }
  if (result.hotels.length) {
    lines.push("");
    lines.push("Stays:");
    for (const h of result.hotels.slice(0, 3)) {
      lines.push(
        `· ${h.name} · ${h.nights}n · $${Math.round(h.price_total)} (${h.source})`,
      );
    }
  }
  if (result.itinerary.length) {
    lines.push("");
    lines.push("Itinerary:");
    for (const day of result.itinerary) {
      lines.push(`· ${day.day_label}`);
      for (const item of day.items.slice(0, 5)) lines.push(`  – ${item}`);
    }
  }
  if (result.asks.length) {
    lines.push("");
    lines.push("Still need:");
    for (const a of result.asks) {
      lines.push(
        `· ${a.prompt}${a.options?.length ? ` [${a.options.join(" | ")}]` : ""}`,
      );
    }
  } else if (result.ready_to_book) {
    lines.push("");
    lines.push("Reply APPROVE when you want mandates / booking.");
  }
  return lines.join("\n").trim();
}

/**
 * End-to-end reel → clarify asks + optional flights/hotels/tickets + itinerary.
 */
export async function planFromReel(
  input: ReelPlanInput,
): Promise<ReelPlanResult> {
  const url = input.url?.trim() || null;
  const cached =
    input.cached_caption?.trim() ||
    input.caption?.trim() ||
    "";

  let metaCaption = cached;
  let metaSource = cached ? "client_cache" : "none";
  let metaAuthor: string | undefined;
  let imageUrls: string[] | undefined;
  let videoUrls: string[] | undefined;

  if (url && !cached) {
    const meta = await fetchReelCaption(url);
    metaCaption = meta.caption;
    metaSource = meta.source;
    metaAuthor = meta.author;
    imageUrls = meta.image_urls;
    videoUrls = meta.video_urls;
  }

  const captionSeed = [input.caption, metaCaption, input.transcript]
    .filter((s) => s && String(s).trim())
    .join("\n\n");

  const needsVision =
    Boolean(url) &&
    !cached &&
    captionSeed.trim().length < 400 &&
    Boolean(imageUrls?.length || videoUrls?.length);

  const visualText = needsVision
    ? await extractVisualTextFromReel({
        image_urls: imageUrls,
        video_urls: videoUrls,
      })
    : null;

  const captionBits = [
    input.caption && input.caption !== metaCaption ? input.caption : "",
    metaCaption,
    visualText
      ? `VISUAL_OCR (on-screen text from reel media):\n${visualText}`
      : "",
    input.transcript,
  ]
    .filter((s) => s && String(s).trim())
    .join("\n\n");

  if (url && !captionBits.trim()) {
    throw new Error(
      "Couldn't read that reel's caption or on-screen text (private or blocked). Try a public Instagram/TikTok link.",
    );
  }

  const brief = await decodeReelWithGemini({
    url,
    caption: captionBits || metaCaption,
    pasted_transcript: input.transcript,
    source: url ? reelSourceFromUrl(url) : input.transcript ? "paste" : "other",
  });

  if (metaSource && metaSource !== "none") {
    const visionNote = visualText
      ? ` · +visual OCR ${visualText.length} chars`
      : "";
    brief.transcript_or_caption = `[fetched via ${metaSource}${metaAuthor ? ` · @${metaAuthor}` : ""} · ${metaCaption.length} chars${visionNote}]\n${brief.transcript_or_caption}`;
  }

  if (input.origin_city) brief.origin_city = input.origin_city;
  if (input.budget_cap != null) brief.budget_cap = input.budget_cap;
  if (input.party_size) brief.party_size_hint = input.party_size;
  applyBudgetFromReel(brief, captionBits || metaCaption, input.party_size);

  const asks = buildAsks(brief, input);
  const stage =
    input.stage ||
    (asks.length === 0 || input.relaxed ? "finalize" : "preview");
  const doPackages = stage === "finalize" && asks.length === 0;

  const city = brief.city || "Chicago";
  const tripDates = resolveTripDates({
    selected_date: input.selected_date,
    date_range: input.date_range,
    days: brief.days,
  });
  const dateLabel =
    input.date_range ||
    input.selected_date ||
    `${tripDates.check_in} → ${tripDates.check_out}`;

  let tickets: ReelTicketOption[] = [];
  let flights: ReelFlightOption[] = [];
  let hotels: ReelHotelOption[] = [];
  let itinerary: ReelItineraryDay[] = [];

  if (doPackages && wantsTicketmaster(brief)) {
    const keywords =
      brief.ticket_keywords.length > 0
        ? brief.ticket_keywords
        : brief.events.map((e) => e.title).filter(Boolean).slice(0, 2);
    const kw = keywords[0] || "concert";
    const tm = await searchTickets({
      keyword: kw,
      city,
      max_price:
        brief.budget_currency === "USD"
          ? (input.budget_cap ?? brief.budget_cap ?? undefined)
          : undefined,
    });
    tickets = tm.offers.slice(0, 5).map((o) => ({
      id: o.id,
      event_name: o.event_name,
      venue: o.venue,
      date: o.date,
      price: o.price,
      currency: o.currency,
      vendor: o.vendor,
      source: tm.source,
    }));
  }

  if (doPackages && brief.mode === "trip") {
    const origin = input.origin_city || brief.origin_city || undefined;
    const originCode = origin ? airportCodeForPlace(origin) : null;
    const destCode = airportCodeForPlace(city);

    if (originCode && destCode && originCode !== destCode) {
      try {
        const fl = await searchFlights({
          origin: originCode,
          destination: destCode,
          depart_date: tripDates.check_in,
        });
        flights = fl.offers.slice(0, 5).map((o) => {
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
            source: fl.source,
          };
        });
      } catch {
        /* keep empty */
      }
    }

    try {
      const ht = await searchHotels({
        city,
        check_in: tripDates.check_in,
        check_out: tripDates.check_out,
      });
      hotels = ht.offers.slice(0, 6).map((o, i) => ({
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
      }));
    } catch {
      /* keep empty */
    }
  }

  if (doPackages) {
    itinerary = await buildEnrichedItinerary({
      brief,
      party_size: input.party_size ?? brief.party_size_hint ?? undefined,
      origin_city: input.origin_city ?? brief.origin_city ?? undefined,
      date_label: dateLabel,
      check_in: tripDates.check_in,
      check_out: tripDates.check_out,
    });
  } else if (stage === "preview") {
    // Light sketch only — full plan comes after prefs
    itinerary = [
      {
        day_label: "Preview",
        items: [
          brief.summary.slice(0, 160),
          ...(brief.places.slice(0, 4).map((p) => `Spot · ${p}`)),
          "Fill preferences below, then build the full plan (flights + stays + days).",
        ],
      },
    ];
  }

  const ready_to_book =
    asks.length === 0 &&
    Boolean(input.party_size || brief.party_size_hint) &&
    Boolean(input.selected_date || input.date_range || brief.dates.length);

  const partial = {
    brief,
    asks,
    tickets,
    flights,
    hotels,
    itinerary,
    ready_to_book: input.relaxed ? asks.length === 0 : ready_to_book,
  };
  return {
    ...partial,
    whatsapp_message: formatWhatsApp(partial),
    cached_caption: metaCaption || captionBits,
  };
}

export function parseReelFollowUp(
  text: string,
  prior: ReelBrief,
): Partial<ReelPlanInput> {
  const lower = text.trim().toLowerCase();
  const out: Partial<ReelPlanInput> = {};
  const party = lower.match(/\b([1-9]|10)\s*(people|ppl|person|solo)?\b/);
  if (/^solo\b/.test(lower)) out.party_size = 1;
  else if (party) out.party_size = Number(party[1]);

  const budget = lower.match(/\$?\s*(\d{2,5})\b/);
  if (/budget|under|cap/i.test(lower) && budget) {
    out.budget_cap = Number(budget[1]);
  } else if (/^\$?\d{2,5}$/.test(lower.trim()) && budget) {
    out.budget_cap = Number(budget[1]);
  }

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) out.selected_date = iso[1];
  else {
    for (const d of prior.dates) {
      if (text.includes(d)) out.selected_date = d;
    }
  }

  if (
    !out.selected_date &&
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\s*[-–to]+\s*\d{1,2})/i.test(
      text,
    )
  ) {
    out.date_range = text.trim();
  }

  const time = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (time) out.selected_time = time[1];

  if (
    /^[A-Za-z].+/.test(text.trim()) &&
    text.trim().length < 40 &&
    !out.date_range
  ) {
    if (!/\d/.test(text)) out.origin_city = text.trim();
  }

  return out;
}

export { formatBudget };
