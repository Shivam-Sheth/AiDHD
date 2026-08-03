import { completeJson } from "@/lib/integrations/llm";

/**
 * Reel -> shopping list.
 *
 * The existing reel pipeline is travel-shaped (city, dates, tickets). A recipe
 * or fashion reel carries a different payload: things to buy. This turns the
 * caption + on-screen text into structured items.
 *
 * Deliberately merchant-agnostic. It emits `store_hint` as free text only, so a
 * commerce provider (Shopify or otherwise) can resolve items to real SKUs later
 * without this module knowing anything about that.
 */

export type ShoppingListKind = "recipe" | "fashion" | "haul" | "general";

export type ShoppingItem = {
  name: string;
  /** Numeric where the reel gives one; null when it just says "some". */
  quantity: number | null;
  /** "g", "cups", "pcs", or null. */
  unit: string | null;
  /** Loose grouping so the UI can section the list: "produce", "tops", ... */
  category: string | null;
  /** Brand or shop the reel actually names. Never invented. */
  store_hint: string | null;
  /** Anything qualifying: "room temperature", "size 10", "or almond milk". */
  notes: string | null;
  /** Model's confidence this really is a purchasable item, 0-1. */
  confidence: number;
};

export type ReelShoppingList = {
  kind: ShoppingListKind;
  title: string;
  items: ShoppingItem[];
  /** Steps, when the reel is a recipe or tutorial. Empty otherwise. */
  steps: string[];
  /** Set when the reel states a total; we never estimate prices ourselves. */
  stated_total: string | null;
  source_url: string | null;
  confidence: number;
};

const SYSTEM = `You turn a short-form video's caption and on-screen text into a structured shopping list.

Rules:
- Only list things a person would actually buy. Skip tools they already own unless the reel explicitly says to buy them.
- Never invent brands, shops, prices or quantities. If the reel does not say, use null.
- quantity must be a number or null — never a string like "a handful".
- Put qualifiers ("room temperature", "size 10", "or use oat milk") in notes, not in name.
- kind: "recipe" for food, "fashion" for clothing/accessories, "haul" for a mixed product roundup, "general" otherwise.
- steps: only for recipes/tutorials, short imperative lines. Otherwise [].
- confidence: 0-1, how sure you are the item is real and purchasable.

Return JSON only.`;

const SHAPE = `{
  "kind": "recipe|fashion|haul|general",
  "title": "string",
  "items": [{
    "name": "string",
    "quantity": number|null,
    "unit": "string|null",
    "category": "string|null",
    "store_hint": "string|null",
    "notes": "string|null",
    "confidence": 0.0
  }],
  "steps": ["string"],
  "stated_total": "string|null",
  "confidence": 0.0
}`;

function coerceItem(raw: unknown): ShoppingItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;

  // Models routinely return "2" or "a couple" for quantity; keep only real numbers.
  const q = typeof o.quantity === "number" && Number.isFinite(o.quantity) ? o.quantity : null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    name,
    quantity: q,
    unit: str(o.unit),
    category: str(o.category),
    store_hint: str(o.store_hint),
    notes: str(o.notes),
    confidence:
      typeof o.confidence === "number" ? Math.min(1, Math.max(0, o.confidence)) : 0.5,
  };
}

export async function extractShoppingList(input: {
  caption: string;
  visual_text?: string | null;
  title?: string | null;
  source_url?: string | null;
}): Promise<ReelShoppingList> {
  const body = [
    input.title ? `TITLE: ${input.title}` : "",
    `CAPTION:\n${input.caption || "(none)"}`,
    input.visual_text ? `ON-SCREEN TEXT:\n${input.visual_text}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const empty: ReelShoppingList = {
    kind: "general",
    title: input.title || "Shopping list",
    items: [],
    steps: [],
    stated_total: null,
    source_url: input.source_url ?? null,
    confidence: 0,
  };

  if (!body.trim() || body.trim() === "CAPTION:\n(none)") return empty;

  const completion = await completeJson({
    system: SYSTEM,
    user: `${body}\n\nReturn JSON matching exactly:\n${SHAPE}`,
  }).catch(() => null);

  // completeJson returns the raw completion envelope, not parsed JSON — the
  // model's output still has to be parsed, and Gemini often wraps it in a
  // markdown fence even when asked for JSON only.
  if (!completion?.text) return empty;
  const raw = completion.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");

  let p: Record<string, unknown>;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return empty;
    p = j as Record<string, unknown>;
  } catch {
    return empty;
  }

  const items = Array.isArray(p.items)
    ? p.items.map(coerceItem).filter((i): i is ShoppingItem => i !== null)
    : [];

  const kind = (["recipe", "fashion", "haul", "general"] as const).includes(
    p.kind as ShoppingListKind,
  )
    ? (p.kind as ShoppingListKind)
    : "general";

  return {
    kind,
    title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : empty.title,
    items,
    steps:
      Array.isArray(p.steps) && kind !== "fashion"
        ? p.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [],
    stated_total: typeof p.stated_total === "string" ? p.stated_total : null,
    source_url: input.source_url ?? null,
    // No items means no useful extraction, whatever the model claims.
    confidence: items.length
      ? typeof p.confidence === "number"
        ? Math.min(1, Math.max(0, p.confidence))
        : 0.6
      : 0,
  };
}
