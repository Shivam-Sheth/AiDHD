import { completeJson } from "../integrations/llm";
import {
  extractDaySections,
  heuristicDecodeReel,
  mergeReelBrief,
} from "./heuristic";
import type { ReelBrief, ReelSource } from "./types";

/**
 * Gemini decodes caption / pasted transcript into a ReelBrief.
 * Falls back to heuristic extraction when the LLM is down / rate-limited.
 */
export async function decodeReelWithGemini(input: {
  url?: string | null;
  caption?: string;
  pasted_transcript?: string;
  source?: ReelSource;
  todayIso?: string;
}): Promise<ReelBrief> {
  const today = input.todayIso || new Date().toISOString().slice(0, 10);
  const blob = [
    input.url ? `URL: ${input.url}` : "",
    input.caption ? `CAPTION:\n${input.caption}` : "",
    input.pasted_transcript
      ? `TRANSCRIPT:\n${input.pasted_transcript}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const heuristic = heuristicDecodeReel(input);

  if (!blob.trim()) return heuristic;

  const result = await completeJson({
    system: `You extract a travel/outing brief from an Instagram/TikTok reel caption for AiDHD.
Return ONLY JSON:
{"title":string,"summary":string,"city":string|null,"origin_city":string|null,"budget_cap":number|null,"budget_currency":"USD"|"INR"|string|null,"budget_total":number|null,"days":number|null,"dates":["YYYY-MM-DD"],"places":[string],"events":[{"title":string,"venue":string|null,"city":string|null,"dates":["YYYY-MM-DD"],"times":[string],"ticket_hint":string|null}],"ticket_keywords":[string],"mode":"outing"|"trip"|"local_event","party_size_hint":number|null,"confidence":0-1}

Rules:
- today is ${today}. Year defaults to 2026 unless stated.
- Read the FULL caption AND any VISUAL_OCR block (on-screen itinerary text from the video/images). Prefer day-by-day lists from VISUAL_OCR when present; merge with caption places.
- Pull every place, activity, stay tip, and day-by-day item into places[] (e.g. Ubud, Canggu, Nusa Penida, Tegallalang, Uluwatu, warungs, ATV). places[] MUST be non-empty when the caption mentions destinations.
- If caption/visual text is a multi-day trip (Bali, Europe, etc.) set mode=trip and days from "5–6 days" / "Day 1–Day 5" style phrases.
- Budget: parse EXACTLY from the caption. "₹50,000 for 2 people" / "under ₹50,000 for 2" => budget_currency="INR", budget_total=50000 (group), party_size_hint=2, budget_cap=25000 (per person = total÷people). "₹50,000/pp" or "₹50,000 per person" => budget_cap=50000, budget_total=50000*party. Never treat ₹ as USD.
- "$400/pp" => budget_currency="USD", budget_cap=400.
- party_size_hint from "for 2 people", "solo", "group of 4", etc.
- dates[] only if concrete calendar dates appear; otherwise dates=[].
- ticket_keywords: ONLY if there is a bookable show/concert/fair (Ticketmaster-style). Empty [] for general travel tips / Airbnb / scooter itineraries.
- summary: 1–2 sentences. title: short punchy.
- confidence higher when caption is long and detailed.`,
    user: blob.slice(0, 14000),
  });

  if (!result?.text) return heuristic;

  try {
    const cleaned = result.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || cleaned) as Partial<ReelBrief> & {
      budget_currency?: string | null;
      budget_total?: number | null;
    };

    const llmBrief: ReelBrief = {
      source_url: input.url ?? null,
      source: input.source ?? "other",
      title: parsed.title || heuristic.title,
      summary: parsed.summary || heuristic.summary,
      transcript_or_caption: blob,
      city: parsed.city ?? null,
      origin_city: parsed.origin_city ?? null,
      budget_cap:
        parsed.budget_cap != null && Number.isFinite(Number(parsed.budget_cap))
          ? Number(parsed.budget_cap)
          : null,
      budget_currency: parsed.budget_currency ?? null,
      budget_total:
        parsed.budget_total != null &&
        Number.isFinite(Number(parsed.budget_total))
          ? Number(parsed.budget_total)
          : null,
      days: parsed.days ?? null,
      dates: Array.isArray(parsed.dates)
        ? parsed.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [],
      places: Array.isArray(parsed.places) ? parsed.places.map(String) : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      ticket_keywords: Array.isArray(parsed.ticket_keywords)
        ? parsed.ticket_keywords.map(String)
        : [],
      mode:
        parsed.mode === "trip" ||
        parsed.mode === "outing" ||
        parsed.mode === "local_event"
          ? parsed.mode
          : "local_event",
      party_size_hint: parsed.party_size_hint ?? null,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };

    // Prefer Day N sections from caption when LLM forgot them
    const daySecs = extractDaySections(blob);
    if (daySecs.length && llmBrief.places.length < daySecs.length) {
      llmBrief.places = [
        ...daySecs.flatMap((d) => d.items.map((it) => `Day ${d.day}: ${it}`)),
        ...llmBrief.places,
      ];
    }

    return mergeReelBrief(llmBrief, heuristic);
  } catch {
    return heuristic;
  }
}
