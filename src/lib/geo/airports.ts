/**
 * City ↔ airport / coords — never silently default to JFK/MIA.
 */

export type AirportHit = {
  iata: string;
  city: string;
  lat: number;
  lng: number;
};

const KNOWN: Array<{
  match: RegExp;
  iata: string;
  city: string;
  lat: number;
  lng: number;
}> = [
  { match: /\b(new york|nyc|jfk|lga|ewr|manhattan|brooklyn)\b/i, iata: "JFK", city: "New York", lat: 40.6413, lng: -73.7781 },
  { match: /\b(miami|mia|south beach)\b/i, iata: "MIA", city: "Miami", lat: 25.7959, lng: -80.287 },
  { match: /\b(chicago|ord|mdw)\b/i, iata: "ORD", city: "Chicago", lat: 41.9742, lng: -87.9073 },
  { match: /\b(los angeles|l\.?a\.?\b|lax)\b/i, iata: "LAX", city: "Los Angeles", lat: 33.9425, lng: -118.408 },
  { match: /\b(boston|bos)\b/i, iata: "BOS", city: "Boston", lat: 42.3656, lng: -71.0096 },
  { match: /\b(atlanta|atl)\b/i, iata: "ATL", city: "Atlanta", lat: 33.6407, lng: -84.4277 },
  { match: /\b(dallas|dfw|fort worth)\b/i, iata: "DFW", city: "Dallas", lat: 32.8998, lng: -97.0403 },
  { match: /\b(seattle|sea)\b/i, iata: "SEA", city: "Seattle", lat: 47.4502, lng: -122.3088 },
  { match: /\b(austin|aus)\b/i, iata: "AUS", city: "Austin", lat: 30.1945, lng: -97.6699 },
  { match: /\b(denver|den)\b/i, iata: "DEN", city: "Denver", lat: 39.8561, lng: -104.6737 },
  { match: /\b(san francisco|sf\b|sfo)\b/i, iata: "SFO", city: "San Francisco", lat: 37.6213, lng: -122.379 },
  { match: /\b(houston|iah|hou)\b/i, iata: "IAH", city: "Houston", lat: 29.9902, lng: -95.3368 },
  { match: /\b(philadelphia|phl)\b/i, iata: "PHL", city: "Philadelphia", lat: 39.8729, lng: -75.2437 },
  { match: /\b(phoenix|phx)\b/i, iata: "PHX", city: "Phoenix", lat: 33.4373, lng: -112.0078 },
  { match: /\b(las vegas|las)\b/i, iata: "LAS", city: "Las Vegas", lat: 36.084, lng: -115.1537 },
  { match: /\b(washington|d\.?c\.?|iad|dca)\b/i, iata: "IAD", city: "Washington", lat: 38.9531, lng: -77.4565 },
  { match: /\b(orlando|mco)\b/i, iata: "MCO", city: "Orlando", lat: 28.4312, lng: -81.3081 },
  { match: /\b(nashville|bna)\b/i, iata: "BNA", city: "Nashville", lat: 36.1263, lng: -86.6774 },
  { match: /\b(bali|denpasar|dps|ubud|canggu|uluwatu)\b/i, iata: "DPS", city: "Bali", lat: -8.7482, lng: 115.1672 },
  { match: /\b(tokyo|hnd|nrt)\b/i, iata: "HND", city: "Tokyo", lat: 35.5494, lng: 139.7798 },
  { match: /\b(paris|cdg)\b/i, iata: "CDG", city: "Paris", lat: 49.0097, lng: 2.5479 },
  { match: /\b(london|lhr|lgw)\b/i, iata: "LHR", city: "London", lat: 51.47, lng: -0.4543 },
  { match: /\b(bangkok|bkk)\b/i, iata: "BKK", city: "Bangkok", lat: 13.69, lng: 100.7501 },
  { match: /\b(singapore|sin)\b/i, iata: "SIN", city: "Singapore", lat: 1.3644, lng: 103.9915 },
  { match: /\b(dubai|dxb)\b/i, iata: "DXB", city: "Dubai", lat: 25.2532, lng: 55.3657 },
  { match: /\b(delhi|new delhi|del)\b/i, iata: "DEL", city: "Delhi", lat: 28.5562, lng: 77.100 },
  { match: /\b(mumbai|bom)\b/i, iata: "BOM", city: "Mumbai", lat: 19.0896, lng: 72.8656 },
];

const IATA_RE = /\b([A-Z]{3})\b/;

export function lookupPlace(place: string): AirportHit | null {
  const raw = place.trim();
  if (!raw) return null;
  for (const row of KNOWN) {
    if (row.match.test(raw)) {
      return { iata: row.iata, city: row.city, lat: row.lat, lng: row.lng };
    }
  }
  const iata = raw.toUpperCase().match(IATA_RE)?.[1];
  if (iata && KNOWN.some((k) => k.iata === iata)) {
    const row = KNOWN.find((k) => k.iata === iata)!;
    return { iata: row.iata, city: row.city, lat: row.lat, lng: row.lng };
  }
  return null;
}

/** Prefer known mapping; never invent JFK for unknown cities. */
export function airportCodeForPlace(place: string): string | null {
  return lookupPlace(place)?.iata ?? null;
}

export function displayCityForPlace(place: string): string {
  return lookupPlace(place)?.city ?? titleCase(place);
}

export function coordsForCity(city: string): { latitude: number; longitude: number } | null {
  const hit = lookupPlace(city);
  if (!hit) return null;
  return { latitude: hit.lat, longitude: hit.lng };
}

function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function tagValue(tags: string[], prefix: string): string | undefined {
  const hit = tags.find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!hit) return undefined;
  return hit.slice(prefix.length).trim() || undefined;
}
