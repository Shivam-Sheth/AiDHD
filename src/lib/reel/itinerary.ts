/**
 * Build a concrete day-by-day itinerary from a condensed reel brief + prefs.
 */

import { completeJson } from "../integrations/llm";
import type { ReelBrief, ReelItineraryDay } from "./types";

function heuristicTripDays(
  brief: ReelBrief,
  dateLabel?: string,
): ReelItineraryDay[] {
  const dayCount = Math.min(7, Math.max(3, brief.days || 5));
  const places = brief.places.filter((p) => !/^Day\s*\d+/i.test(p));
  const tips = [
    "Private pool villa / Airbnb (book weekly discount)",
    "Scooter rental for getting around",
    "Eat at local warungs",
    "Book day tours on Klook",
  ];

  // Classic Bali-shaped packing if destination matches
  const baliPack: string[][] = [
    ["Arrive & check into villa (Ubud or Canggu)", "Settle in + local warung dinner"],
    ["Ubud temples / Campuhan Ridge Walk", "Tegallalang rice terraces", "Café hop"],
    ["Nusa Penida day trip (Klook)", "Snorkel / cliffs / return evening"],
    ["ATV or Bali Swing", "Canggu beach sunset"],
    ["Uluwatu Temple + Kecak / sunset", "Jimbaran or cliff dinner"],
    ["Seminyak / beach morning", "Souvenirs + pack"],
    ["Buffer / waterfall or spa", "Depart"],
  ];

  const isBali = /bali/i.test(brief.city || "") || /bali/i.test(brief.title);
  const packs = isBali
    ? baliPack
    : Array.from({ length: dayCount }, (_, i) => {
        const slice = places.slice(
          Math.floor((i * places.length) / dayCount),
          Math.floor(((i + 1) * places.length) / dayCount),
        );
        return slice.length
          ? slice
          : [`Explore ${brief.city || "the area"}`, tips[i % tips.length]!];
      });

  return packs.slice(0, dayCount).map((items, i) => ({
    day_label: `Day ${i + 1}${i === 0 && dateLabel ? ` · ${dateLabel}` : ""}${
      i === 0 && brief.city ? ` · ${brief.city}` : ""
    }`,
    items: items.slice(0, 6),
  }));
}

/**
 * Prefer Gemini for a concise day plan; heuristic if quota/errors.
 */
export async function buildEnrichedItinerary(input: {
  brief: ReelBrief;
  party_size?: number;
  origin_city?: string;
  date_label?: string;
  check_in?: string;
  check_out?: string;
}): Promise<ReelItineraryDay[]> {
  const { brief } = input;
  const condensed = [
    `Title: ${brief.title}`,
    `Summary: ${brief.summary}`,
    `City: ${brief.city || "?"}`,
    `Days: ${brief.days || "?"}`,
    `Budget: ${brief.budget_currency || ""} ${brief.budget_total ?? brief.budget_cap ?? ""}`,
    `Places: ${brief.places.slice(0, 16).join(", ")}`,
    input.party_size ? `Party: ${input.party_size}` : "",
    input.origin_city ? `Flying from: ${input.origin_city}` : "",
    input.check_in ? `Dates: ${input.check_in} → ${input.check_out}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fallback = heuristicTripDays(brief, input.date_label);
  const dayCount = fallback.length;

  const result = await completeJson({
    system: `You write a concise ${dayCount}-day travel itinerary from a reel brief.
Return ONLY JSON:
{"days":[{"day_label":"Day 1 · …","items":["activity 1","activity 2","activity 3"]}]}

Rules:
- Exactly ${dayCount} days (or fewer if brief.days is smaller).
- 3–5 concrete items per day (places + practical tips from the brief: villa, Klook, scooter, warungs).
- No fluff. No repeating the full caption. Keep each item under 90 chars.
- Day 1 can mention arrival; last day departure if relevant.
- If Bali, sequence sensibly (Ubud inland → Nusa Penida day trip → Uluwatu south).`,
    user: condensed,
  });

  if (!result?.text) return fallback;

  try {
    const cleaned = result.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned) as {
      days?: ReelItineraryDay[];
    };
    if (!Array.isArray(parsed.days) || parsed.days.length < 2) return fallback;
    return parsed.days.slice(0, 7).map((d, i) => ({
      day_label: d.day_label || `Day ${i + 1}`,
      date: d.date,
      items: (d.items || []).map(String).slice(0, 6),
    }));
  } catch {
    return fallback;
  }
}
