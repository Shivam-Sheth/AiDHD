import { completeJson } from "../integrations/llm";

export type WaIntent =
  | "greeting"
  | "mode_outing"
  | "mode_trip"
  | "budget"
  | "dates"
  | "origin"
  | "destination"
  | "vibe"
  | "confirm_yes"
  | "confirm_no"
  | "packages"
  | "vote"
  | "help"
  | "other";

export type GeminiTurnParse = {
  intent: WaIntent;
  mode?: "outing" | "trip" | null;
  budget?: number | null;
  /** ISO dates YYYY-MM-DD — start/end of range preferred */
  dates?: string[];
  origin_city?: string | null;
  origin_country?: string | null;
  destination?: string | null;
  vibe?: string | null;
  place?: string | null;
  vote?: 1 | 2 | 3 | null;
  /** Short clarification if ambiguous */
  ask?: string | null;
};

/**
 * Gemini (preferred) understands greetings, typos, bare day numbers, vibe free-text.
 * Returns null if LLM unavailable / bad JSON — caller falls back to regex.
 */
export async function parseWhatsAppTurnWithGemini(input: {
  text: string;
  step:
    | "mode"
    | "budget"
    | "origin"
    | "destination"
    | "availability"
    | "preferences"
    | "confirm"
    | "done"
    | "idle";
  eventType?: "outing" | "trip";
  todayIso?: string;
}): Promise<GeminiTurnParse | null> {
  const today = input.todayIso || new Date().toISOString().slice(0, 10);
  const result = await completeJson({
    system: `You parse WhatsApp messages for AiDHD group planning.
Return ONLY JSON matching:
{"intent":"greeting|mode_outing|mode_trip|budget|dates|origin|destination|vibe|confirm_yes|confirm_no|packages|vote|help|other","mode":"outing|trip|null","budget":number|null,"dates":["YYYY-MM-DD"],"origin_city":string|null,"origin_country":string|null,"destination":string|null,"vibe":string|null,"place":string|null,"vote":1|2|3|null,"ask":string|null}

Rules:
- Treat hi/hello/hey/yo/sup/hola/good morning (any spelling/typo/emoji) as intent=greeting.
- "plan" or "outing" or "night out" => mode_outing. "trip"/"travel"/"vacation" => mode_trip.
- Extract budget from messy text ("150 bucks", "under 200", "1.5hundo" ~150).
- Dates: today is ${today}. Year defaults to 2026 for this hackathon demo unless user says otherwise.
- If user gives only day numbers like "11-20" or "11 to 20" without a month, assume the next upcoming month that makes sense (prefer August 2026 for summer plans, else current/next month). Always output ISO dates.
- Typos ok (agust, maimi, chicgo). Normalize cities.
- Origin messages may be "NYC USA" or "new york, us".
- If step is availability and message is only "either/any/flexible", set ask to request a concrete range; dates=[].
- If step is preferences, treat the whole message as vibe/activities — never ask for dates and never set intent=dates.
- If step is confirm, yes/y/yeah/yep/sure/ok confirm => confirm_yes.
- Never classify a vibe/prefs message (movie, dinner, escape room, veg, alc) as greeting or mode_trip/mode_outing.
- Pull multiple fields from one message when present (budget+dates+vibe+place).
- intent should match the primary thing for the current step when possible, but still fill all extractable fields.`,
    user: JSON.stringify({
      step: input.step,
      event_type: input.eventType ?? null,
      message: input.text,
    }),
  });

  if (!result?.text) return null;
  try {
    const parsed = JSON.parse(result.text) as GeminiTurnParse;
    if (!parsed.intent) return null;
    if (parsed.budget != null && Number.isFinite(Number(parsed.budget))) {
      parsed.budget = Number(parsed.budget);
    }
    if (Array.isArray(parsed.dates)) {
      parsed.dates = parsed.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    }
    return parsed;
  } catch {
    return null;
  }
}
