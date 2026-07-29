import { completeJson } from "../integrations/llm";
import type { ReelBrief, ReelSource } from "./types";

/**
 * Gemini decodes caption / pasted transcript / optional URL context into a ReelBrief.
 * When video bytes are available later (WhatsApp media / frontend upload), pass
 * `extraContext` with a transcript from speech-to-text.
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
    input.caption ? `CAPTION/OG: ${input.caption}` : "",
    input.pasted_transcript
      ? `TRANSCRIPT: ${input.pasted_transcript}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fallback: ReelBrief = {
    source_url: input.url ?? null,
    source: input.source ?? "other",
    title: "Reel plan",
    summary: input.caption?.slice(0, 180) || "Shared reel",
    transcript_or_caption: blob,
    city: null,
    dates: [],
    places: [],
    events: [],
    ticket_keywords: [],
    mode: "local_event",
    confidence: 0.2,
  };

  if (!blob.trim()) return fallback;

  const result = await completeJson({
    system: `You extract a travel/outing brief from an Instagram/TikTok reel caption or transcript for AiDHD.
Return ONLY JSON:
{"title":string,"summary":string,"city":string|null,"origin_city":string|null,"budget_cap":number|null,"days":number|null,"dates":["YYYY-MM-DD"],"places":[string],"events":[{"title":string,"venue":string|null,"city":string|null,"dates":["YYYY-MM-DD"],"times":[string],"ticket_hint":string|null}],"ticket_keywords":[string],"mode":"outing"|"trip"|"local_event","party_size_hint":number|null,"confidence":0-1}

Rules:
- today is ${today}. Year defaults to 2026 for this hackathon unless stated.
- If the reel lists a fair/festival on specific dates, put those in dates[] and events[].
- If it's "things to do in Chicago this weekend", set city=Chicago, mode=local_event, dates= upcoming weekend ISO if not explicit.
- If it describes a multi-day trip with budget, set mode=trip and budget_cap.
- ticket_keywords: short Ticketmaster search terms (artist, event, "fair", "concert").
- Never invent a city if none is mentioned — leave city null.
- confidence low if caption is thin.`,
    user: blob.slice(0, 12000),
  });

  if (!result?.text) return fallback;

  try {
    const parsed = JSON.parse(result.text) as Partial<ReelBrief>;
    return {
      source_url: input.url ?? null,
      source: input.source ?? "other",
      title: parsed.title || fallback.title,
      summary: parsed.summary || fallback.summary,
      transcript_or_caption: blob,
      city: parsed.city ?? null,
      origin_city: parsed.origin_city ?? null,
      budget_cap:
        parsed.budget_cap != null && Number.isFinite(Number(parsed.budget_cap))
          ? Number(parsed.budget_cap)
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
  } catch {
    return fallback;
  }
}
