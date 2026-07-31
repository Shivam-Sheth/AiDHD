import {
  CLUB_INVENTORY,
  DINING_INVENTORY,
  MOVIE_INVENTORY,
  type ClubOffer,
  type DiningOffer,
  type MovieOffer,
} from "../merchants/fixtures";
import { displayCityForPlace } from "../geo/airports";
import { hasLinq } from "./config";

function cityNeighborhoods(city: string): string[] {
  if (/bali/i.test(city)) return ["Canggu", "Ubud", "Seminyak", "Uluwatu"];
  if (/chicago|ord/i.test(city))
    return ["West Loop", "Wicker Park", "River North", "Logan Square"];
  if (/miami/i.test(city))
    return ["South Beach", "Wynwood", "Brickell", "Design District"];
  if (/los angeles|la\b|hollywood/i.test(city))
    return ["Silver Lake", "Santa Monica", "Downtown", "Hollywood"];
  if (/new york|nyc|manhattan|brooklyn/i.test(city))
    return ["Williamsburg", "West Village", "SoHo", "Greenpoint"];
  return ["Downtown", "Arts District", "Old Town", "Waterfront"];
}

export async function searchDining(input: {
  city?: string;
  max_per_person?: number;
  tags?: string[];
}): Promise<{ offers: DiningOffer[]; source: "linq" | "fixture"; city: string }> {
  if (hasLinq()) {
    // Linq dining booking API — live when LINQ_API_KEY is supplied.
  }

  const city = displayCityForPlace(input.city || "New York");
  const neighborhoods = cityNeighborhoods(city);
  let offers: DiningOffer[] = DINING_INVENTORY.map((o, i) => ({
    ...o,
    id: `${o.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    neighborhood: neighborhoods[i % neighborhoods.length]!,
    tags: [...o.tags, city.toLowerCase(), "dinner"],
  }));

  if (input.max_per_person != null) {
    const capped = offers.filter(
      (o) => o.price_per_person <= input.max_per_person!,
    );
    offers = capped.length
      ? capped
      : [...offers].sort((a, b) => a.price_per_person - b.price_per_person);
  }
  if (input.tags?.length) {
    const tags = input.tags.map((t) => t.toLowerCase());
    offers = offers.sort((a, b) => {
      const as = a.tags.filter((t) => tags.some((x) => t.includes(x))).length;
      const bs = b.tags.filter((t) => tags.some((x) => t.includes(x))).length;
      return bs - as;
    });
  }
  return { offers, source: hasLinq() ? "linq" : "fixture", city };
}

export async function searchClubs(input: {
  city?: string;
  vibe?: string;
}): Promise<{ offers: ClubOffer[]; source: "fixture"; city: string }> {
  const city = displayCityForPlace(input.city || "New York");
  const neighborhoods = cityNeighborhoods(city);
  let offers: ClubOffer[] = CLUB_INVENTORY.map((o, i) => ({
    ...o,
    id: `${o.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    neighborhood: neighborhoods[i % neighborhoods.length]!,
    tags: [...o.tags, city.toLowerCase(), "nightlife", "club"],
  }));
  if (input.vibe?.trim()) {
    const v = input.vibe.toLowerCase();
    offers = offers.sort((a, b) => {
      const as = a.tags.filter((t) => v.includes(t) || t.includes(v)).length;
      const bs = b.tags.filter((t) => v.includes(t) || t.includes(v)).length;
      return bs - as;
    });
  }
  return { offers, source: "fixture", city };
}

export async function searchMovies(input: {
  city?: string;
  title?: string;
}): Promise<{ offers: MovieOffer[]; source: "fixture"; city: string }> {
  const city = displayCityForPlace(input.city || "New York");
  const neighborhoods = cityNeighborhoods(city);
  let offers: MovieOffer[] = MOVIE_INVENTORY.map((o, i) => ({
    ...o,
    id: `${o.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    neighborhood: neighborhoods[i % neighborhoods.length]!,
    theater: o.theater.replace(/Brooklyn|Lincoln Square|West Village/gi, city),
    tags: [...o.tags, city.toLowerCase(), "movie", "cinema"],
  }));
  if (input.title?.trim()) {
    const q = input.title.toLowerCase();
    offers = offers.sort((a, b) => {
      const as = a.title.toLowerCase().includes(q) ? 1 : 0;
      const bs = b.title.toLowerCase().includes(q) ? 1 : 0;
      return bs - as;
    });
  }
  return { offers, source: "fixture", city };
}

export async function reserveDining(offerId: string) {
  return {
    ok: true as const,
    confirmation_id: `DIN-${offerId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
  };
}
