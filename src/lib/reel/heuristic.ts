import type { ReelBrief, ReelSource } from "./types";

const CITY_HINTS: Array<{ re: RegExp; city: string; mode?: "trip" }> = [
  { re: /\bbali\b/i, city: "Bali", mode: "trip" },
  { re: /\bubud\b|\bcanggu\b|\buluwatu\b|\bnusa\s*penida\b/i, city: "Bali", mode: "trip" },
  { re: /\bchicago\b/i, city: "Chicago" },
  { re: /\bnew\s*york\b|\bnyc\b|\bmanhattan\b/i, city: "New York" },
  { re: /\bmiami\b/i, city: "Miami" },
  { re: /\blos\s*angeles\b|\bhollywood\b|\bhollywoodwood\b/i, city: "Los Angeles" },
  { re: /\bparis\b/i, city: "Paris", mode: "trip" },
  { re: /\btokyo\b/i, city: "Tokyo", mode: "trip" },
  { re: /\bbangkok\b/i, city: "Bangkok", mode: "trip" },
  { re: /\blondon\b/i, city: "London", mode: "trip" },
  { re: /\bdubai\b/i, city: "Dubai", mode: "trip" },
  { re: /\bsingapore\b/i, city: "Singapore", mode: "trip" },
  { re: /\bvietnam\b|\bda\s*nang\b|\bho\s*chi\s*minh\b/i, city: "Vietnam", mode: "trip" },
  { re: /\bthailand\b|\bphuket\b|\bchiang\s*mai\b/i, city: "Thailand", mode: "trip" },
  { re: /\bindonesia\b/i, city: "Indonesia", mode: "trip" },
  { re: /\beurope\b|\bitaly\b|\bspain\b|\bgreece\b/i, city: "Europe", mode: "trip" },
];

const PLACE_PATTERNS: RegExp[] = [
  /\bUbud\b/g,
  /\bCanggu\b/g,
  /\bSeminyak\b/g,
  /\bUluwatu\b/g,
  /\bNusa\s+Penida\b/gi,
  /\bTegallalang\b/gi,
  /\bTanah\s+Lot\b/gi,
  /\bMount\s+Batur\b/gi,
  /\bGili\s+Islands?\b/gi,
  /\bKuta\b/g,
  /\bJimbaran\b/g,
  /\bSanur\b/g,
  /\bATV\b/g,
  /\bwarungs?\b/gi,
  /\bKlook\b/g,
  /\bAirbnb\s+Villas?\b/gi,
  /\bprivate\s+pool\s+villas?\b/gi,
  /\bscooter\b/gi,
  /\bMillennium\s+Park\b/gi,
  /\bArt\s+Institute\b/gi,
  /\bNavy\s+Pier\b/gi,
  /\bRiverwalk\b/gi,
  /\bCloud\s+Gate\b/gi,
];

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || t.length < 2) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function extractBudget(text: string): {
  budget_currency: string | null;
  budget_total: number | null;
  budget_cap: number | null;
  party_size_hint: number | null;
  budget_note?: string;
} {
  let party: number | null = null;
  const partyMatch =
    text.match(/for\s+(\d+)\s+people/i) ||
    text.match(/for\s+(\d+)\b/i) ||
    text.match(/group\s+of\s+(\d+)/i) ||
    text.match(/\b(\d+)\s+pax\b/i);
  if (partyMatch) party = Number(partyMatch[1]);
  if (/\bsolo\b/i.test(text)) party = 1;

  // Prefer explicit per-person phrasing
  const inrPp = text.match(
    /₹\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*pp|per\s*person|each|pp\b)/i,
  );
  if (inrPp) {
    const pp = Number(inrPp[1].replace(/,/g, ""));
    if (Number.isFinite(pp)) {
      return {
        budget_currency: "INR",
        budget_cap: pp,
        budget_total: party && party > 0 ? pp * party : pp,
        party_size_hint: party,
        budget_note: `Reel says ₹${pp.toLocaleString("en-IN")}/pp`,
      };
    }
  }

  // "under ₹50,000 for 2 people" → amount is GROUP total
  const inrFor = text.match(
    /₹\s*([\d,]+(?:\.\d+)?)\s*(?:for|\/)\s*(\d+)\s*(?:people|pax|persons?)?/i,
  );
  if (inrFor) {
    const total = Number(inrFor[1].replace(/,/g, ""));
    const n = Number(inrFor[2]);
    if (Number.isFinite(total) && n > 0) {
      const pp = Math.round(total / n);
      return {
        budget_currency: "INR",
        budget_total: total,
        budget_cap: pp,
        party_size_hint: n,
        budget_note: `Reel says ₹${total.toLocaleString("en-IN")} for ${n} → ₹${pp.toLocaleString("en-IN")}/pp`,
      };
    }
  }

  const inrUnder = text.match(
    /(?:under|below|within)\s*₹\s*([\d,]+(?:\.\d+)?)/i,
  );
  const inr =
    inrUnder ||
    text.match(/₹\s*([\d,]+(?:\.\d+)?)/) ||
    text.match(/INR\s*([\d,]+)/i) ||
    text.match(/Rs\.?\s*([\d,]+)/i);
  if (inr) {
    const amount = Number(inr[1].replace(/,/g, ""));
    if (Number.isFinite(amount)) {
      if (party && party > 1) {
        const pp = Math.round(amount / party);
        return {
          budget_currency: "INR",
          budget_total: amount,
          budget_cap: pp,
          party_size_hint: party,
          budget_note: `Reel says ₹${amount.toLocaleString("en-IN")} for ${party} → ₹${pp.toLocaleString("en-IN")}/pp`,
        };
      }
      return {
        budget_currency: "INR",
        budget_cap: amount,
        budget_total: amount,
        party_size_hint: party,
        budget_note: `Reel says ₹${amount.toLocaleString("en-IN")}`,
      };
    }
  }

  const usdPp = text.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*pp|per\s*person|each)/i,
  );
  if (usdPp) {
    const pp = Number(usdPp[1].replace(/,/g, ""));
    if (Number.isFinite(pp)) {
      return {
        budget_currency: "USD",
        budget_cap: pp,
        budget_total: party && party > 0 ? pp * party : null,
        party_size_hint: party,
        budget_note: `Reel says $${pp}/pp`,
      };
    }
  }

  const usdFor = text.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(?:for|\/)\s*(\d+)\s*(?:people|pax)?/i,
  );
  if (usdFor) {
    const total = Number(usdFor[1].replace(/,/g, ""));
    const n = Number(usdFor[2]);
    if (Number.isFinite(total) && n > 0) {
      return {
        budget_currency: "USD",
        budget_total: total,
        budget_cap: Math.round(total / n),
        party_size_hint: n,
        budget_note: `Reel says $${total} for ${n} → $${Math.round(total / n)}/pp`,
      };
    }
  }

  const usd = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (usd) {
    const n = Number(usd[1].replace(/,/g, ""));
    if (Number.isFinite(n)) {
      return {
        budget_currency: "USD",
        budget_cap: n,
        budget_total: party && party > 1 ? n : null,
        party_size_hint: party,
      };
    }
  }

  return {
    budget_currency: null,
    budget_total: null,
    budget_cap: null,
    party_size_hint: party,
  };
}

/** Public: derive pp/total from whatever the uploaded reel caption says. */
export function budgetFromCaption(text: string) {
  return extractBudget(text);
}

function extractDays(text: string): number | null {
  const m =
    text.match(/(\d+)\s*[–—-]\s*(\d+)\s*days?/i) ||
    text.match(/\b(\d+)\s*days?\b/i) ||
    text.match(/day\s*(\d+)\b/gi);
  if (!m) {
    const dayLabels = text.match(/\bDay\s*[1-7]\b/gi);
    if (dayLabels?.length) {
      const nums = dayLabels.map((d) => Number(d.replace(/\D/g, "")));
      return Math.max(...nums.filter((n) => n > 0));
    }
    return null;
  }
  if (m[2] && /^\d+$/.test(m[2])) {
    return Math.max(Number(m[1]), Number(m[2]));
  }
  if (m[1] && /^\d+$/.test(m[1])) return Number(m[1]);
  return null;
}

/** Pull day-labeled sections from caption into place/activity lines. */
export function extractDaySections(
  text: string,
): Array<{ day: number; items: string[] }> {
  const sections: Array<{ day: number; items: string[] }> = [];
  const re = /(?:^|\n)\s*(?:🗓️\s*)?Day\s*(\d+)\s*[:\-–—]?\s*([^\n]*)/gi;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return sections;

  for (let i = 0; i < matches.length; i++) {
    const day = Number(matches[i]![1]);
    const start = matches[i]!.index! + matches[i]![0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;
    const header = (matches[i]![2] || "").trim();
    const body = text.slice(start, end);
    const bullets = body
      .split(/\n+/)
      .map((l) =>
        l
          .replace(/^[\s•\-–—*🔹👉✅]+/, "")
          .replace(/^[0-9]+[.)]\s*/, "")
          .trim(),
      )
      .filter((l) => l.length > 3 && l.length < 160 && !/^day\s*\d+/i.test(l));
    const items = uniq([header, ...bullets].filter(Boolean)).slice(0, 8);
    if (items.length) sections.push({ day, items });
  }
  return sections;
}

function extractPlaces(text: string): string[] {
  const found: string[] = [];
  for (const re of PLACE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      found.push(m[0].replace(/\s+/g, " "));
    }
  }

  // Bullet / emoji list lines often hold activities
  for (const line of text.split(/\n+/)) {
    const clean = line
      .replace(/^[\s•\-–—*🔹👉✅🇮🇩🏝️😱👇]+/u, "")
      .trim();
    if (
      clean.length > 8 &&
      clean.length < 100 &&
      /villa|tour|trip|sunset|breakfast|stay|book|scooter|warung|temple|beach|market|cafe|café|hike|snorkel|dive|surf/i.test(
        clean,
      )
    ) {
      found.push(clean.replace(/\s+/g, " "));
    }
  }

  return uniq(found).slice(0, 24);
}

/**
 * Offline decoder used when Gemini quota/errors out.
 * Good enough for common travel-tip reels (Bali, city weekends, etc.).
 */
export function heuristicDecodeReel(input: {
  url?: string | null;
  caption?: string;
  pasted_transcript?: string;
  source?: ReelSource;
}): ReelBrief {
  const text = [input.caption, input.pasted_transcript]
    .filter(Boolean)
    .join("\n\n");
  const blob = [
    input.url ? `URL: ${input.url}` : "",
    input.caption ? `CAPTION:\n${input.caption}` : "",
    input.pasted_transcript
      ? `TRANSCRIPT:\n${input.pasted_transcript}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const cityHit = CITY_HINTS.find((c) => c.re.test(text));
  const budget = extractBudget(text);
  const days = extractDays(text);
  const daySections = extractDaySections(text);
  const placesFromDays = daySections.flatMap((d) => d.items);
  const places = uniq([...placesFromDays, ...extractPlaces(text)]);

  const isTrip =
    cityHit?.mode === "trip" ||
    /trip|itinerary|days?\b|flight|hotel|airbnb|villa|₹|international/i.test(
      text,
    ) ||
    (days != null && days >= 3);

  const titleCity = cityHit?.city || "Trip";
  const title = isTrip
    ? `${titleCity} itinerary${days ? ` · ${days} days` : ""}`
    : `${titleCity} plan`;

  const summaryBits = [
    cityHit ? `${cityHit.city} from the reel` : null,
    budget.budget_cap != null && budget.budget_currency === "INR"
      ? `~₹${budget.budget_cap.toLocaleString("en-IN")}/pp`
      : budget.budget_cap != null
        ? `~$${budget.budget_cap}/pp`
        : null,
    days ? `${days}-day sketch` : null,
  ].filter(Boolean);

  return {
    source_url: input.url ?? null,
    source: input.source ?? "other",
    title,
    summary:
      summaryBits.join(" · ") ||
      text.replace(/\s+/g, " ").trim().slice(0, 180) ||
      "Shared reel",
    transcript_or_caption: blob,
    city: cityHit?.city ?? null,
    origin_city: null,
    budget_cap: budget.budget_cap,
    budget_currency: budget.budget_currency,
    budget_total: budget.budget_total,
    budget_note: budget.budget_note ?? null,
    days: days ?? (daySections.length || null),
    dates: [],
    places,
    events: [],
    ticket_keywords: [],
    mode: isTrip ? "trip" : "outing",
    party_size_hint: budget.party_size_hint,
    confidence: places.length >= 3 ? 0.55 : 0.35,
  };
}

/** Merge LLM brief with heuristic fill-ins when fields are empty. */
export function mergeReelBrief(
  primary: ReelBrief,
  fallback: ReelBrief,
): ReelBrief {
  const weak =
    primary.confidence <= 0.25 ||
    primary.title === "Reel plan" ||
    primary.places.length === 0;

  if (!weak) {
    return {
      ...primary,
      places:
        primary.places.length >= 3
          ? primary.places
          : uniq([...primary.places, ...fallback.places]),
      city: primary.city || fallback.city,
      days: primary.days ?? fallback.days,
      budget_cap: fallback.budget_cap ?? primary.budget_cap,
      budget_currency: fallback.budget_currency ?? primary.budget_currency,
      budget_total: fallback.budget_total ?? primary.budget_total,
      budget_note: fallback.budget_note ?? primary.budget_note ?? null,
      party_size_hint: primary.party_size_hint ?? fallback.party_size_hint,
      mode:
        primary.mode === "local_event" && fallback.mode !== "local_event"
          ? fallback.mode
          : primary.mode,
    };
  }

  return {
    ...fallback,
    transcript_or_caption: primary.transcript_or_caption || fallback.transcript_or_caption,
    source_url: primary.source_url ?? fallback.source_url,
    source: primary.source || fallback.source,
  };
}
