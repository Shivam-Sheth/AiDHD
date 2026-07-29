import { searchTickets } from "../integrations/ticketmaster";
import { reelSourceFromUrl } from "./detect";
import { decodeReelWithGemini } from "./decode";
import { fetchReelCaption } from "./fetch-meta";
import type {
  ReelBrief,
  ReelClarifyAsk,
  ReelItineraryDay,
  ReelPlanResult,
  ReelTicketOption,
} from "./types";

export type ReelPlanInput = {
  url?: string | null;
  /** User-pasted transcript or caption override */
  transcript?: string;
  /** Answers to prior clarify asks */
  party_size?: number;
  selected_date?: string;
  selected_time?: string;
  budget_cap?: number;
  origin_city?: string;
};

function buildAsks(
  brief: ReelBrief,
  input: ReelPlanInput,
): ReelClarifyAsk[] {
  const asks: ReelClarifyAsk[] = [];

  if (!input.party_size && !brief.party_size_hint) {
    asks.push({
      field: "party_size",
      prompt: "How many people? (solo = 1, or e.g. 3)",
      options: ["1", "2", "3", "4"],
    });
  }

  if (!input.budget_cap && brief.budget_cap == null) {
    asks.push({
      field: "budget",
      prompt: "Budget per person? (e.g. 80 or 150)",
    });
  }

  if (brief.mode === "trip" && !brief.origin_city && !input.origin_city) {
    asks.push({
      field: "origin",
      prompt: "Flying from which city? (e.g. Chicago)",
    });
  }

  const dates = brief.dates.length
    ? brief.dates
    : brief.events.flatMap((e) => e.dates ?? []);
  const uniqDates = [...new Set(dates)];

  if (uniqDates.length > 1 && !input.selected_date) {
    asks.push({
      field: "date_pick",
      prompt: "Which of these dates works?",
      options: uniqDates,
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

function buildItinerary(
  brief: ReelBrief,
  selectedDate?: string,
): ReelItineraryDay[] {
  const dates =
    selectedDate
      ? [selectedDate]
      : brief.dates.length
        ? brief.dates
        : ["Day 1"];

  if (brief.places.length || brief.events.length) {
    return dates.slice(0, 5).map((d, i) => ({
      day_label: /^\d{4}/.test(d) ? d : `Day ${i + 1}`,
      date: /^\d{4}/.test(d) ? d : undefined,
      items: [
        ...brief.events
          .filter(
            (e) =>
              !e.dates?.length ||
              !selectedDate ||
              e.dates.includes(selectedDate),
          )
          .map((e) => `${e.title}${e.venue ? ` @ ${e.venue}` : ""}`),
        ...brief.places.map((p) => `Visit ${p}`),
      ].slice(0, 6),
    }));
  }

  return [
    {
      day_label: brief.title,
      date: selectedDate,
      items: [brief.summary],
    },
  ];
}

function formatWhatsApp(result: Omit<ReelPlanResult, "whatsapp_message">): string {
  const lines: string[] = [
    `Reel plan: ${result.brief.title}`,
    result.brief.summary,
  ];
  if (result.brief.city) lines.push(`City: ${result.brief.city}`);
  if (result.brief.dates.length) {
    lines.push(`Dates in reel: ${result.brief.dates.join(", ")}`);
  }
  if (result.itinerary.length) {
    lines.push("");
    lines.push("Itinerary sketch:");
    for (const day of result.itinerary) {
      lines.push(`· ${day.day_label}`);
      for (const item of day.items.slice(0, 4)) lines.push(`  – ${item}`);
    }
  }
  if (result.tickets.length) {
    lines.push("");
    lines.push("Ticketmaster matches:");
    for (const [i, t] of result.tickets.slice(0, 5).entries()) {
      lines.push(
        `${i + 1}) ${t.event_name} · ${t.venue} · ${new Date(t.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ~$${Math.round(t.price)} (${t.source})`,
      );
    }
    lines.push("Reply APPROVE 1 / APPROVE 2 … to pick a show time.");
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
 * End-to-end reel → clarify asks + Ticketmaster options + itinerary.
 * Frontend: POST /api/reel/plan. WhatsApp: paste reel link.
 */
export async function planFromReel(
  input: ReelPlanInput,
): Promise<ReelPlanResult> {
  const url = input.url?.trim() || null;
  const meta = url ? await fetchReelCaption(url) : { caption: "" };
  const brief = await decodeReelWithGemini({
    url,
    caption: meta.caption,
    pasted_transcript: input.transcript,
    source: url ? reelSourceFromUrl(url) : input.transcript ? "paste" : "other",
  });

  if (input.origin_city) brief.origin_city = input.origin_city;
  if (input.budget_cap != null) brief.budget_cap = input.budget_cap;

  const asks = buildAsks(brief, input);
  const city = brief.city || "Chicago";
  const keywords =
    brief.ticket_keywords.length > 0
      ? brief.ticket_keywords
      : brief.events.map((e) => e.title).filter(Boolean).slice(0, 2);
  const kw = keywords[0] || brief.title || "concert";

  const tm = await searchTickets({
    keyword: kw,
    city,
    max_price: input.budget_cap ?? brief.budget_cap ?? undefined,
  });

  let tickets: ReelTicketOption[] = tm.offers.slice(0, 5).map((o) => ({
    id: o.id,
    event_name: o.event_name,
    venue: o.venue,
    date: o.date,
    price: o.price,
    currency: o.currency,
    vendor: o.vendor,
    source: tm.source,
  }));

  // If reel named specific dates, prefer offers near those dates
  const focusDate = input.selected_date || brief.dates[0];
  if (focusDate && tickets.length) {
    const sorted = [...tickets].sort((a, b) => {
      const da = Math.abs(Date.parse(a.date) - Date.parse(focusDate));
      const db = Math.abs(Date.parse(b.date) - Date.parse(focusDate));
      return da - db;
    });
    tickets = sorted;
  }

  const itinerary = buildItinerary(brief, input.selected_date || focusDate);
  const ready_to_book =
    asks.length === 0 &&
    (tickets.length > 0 || brief.mode === "trip") &&
    Boolean(input.party_size || brief.party_size_hint);

  const partial = {
    brief,
    asks,
    tickets,
    itinerary,
    ready_to_book,
  };
  return { ...partial, whatsapp_message: formatWhatsApp(partial) };
}

/** Merge a follow-up WhatsApp reply into reel plan input. */
export function parseReelFollowUp(
  text: string,
  prior: ReelBrief,
): Partial<ReelPlanInput> {
  const lower = text.trim().toLowerCase();
  const out: Partial<ReelPlanInput> = {};
  const party = lower.match(/\b([1-9]|10)\s*(people|ppl|person|solo)?\b/);
  if (/^solo\b/.test(lower)) out.party_size = 1;
  else if (party) out.party_size = Number(party[1]);

  const budget = lower.match(/\$?\s*(\d{2,4})\b/);
  if (/budget|under|cap/i.test(lower) && budget) {
    out.budget_cap = Number(budget[1]);
  } else if (/^\$?\d{2,4}$/.test(lower.trim()) && budget) {
    out.budget_cap = Number(budget[1]);
  }

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) out.selected_date = iso[1];
  else {
    for (const d of prior.dates) {
      if (text.includes(d)) out.selected_date = d;
    }
  }

  const time = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (time) out.selected_time = time[1];

  return out;
}
