import {
  CLUB_INVENTORY,
  DINING_INVENTORY,
  MOVIE_INVENTORY,
  type ClubOffer,
  type DiningOffer,
  type MovieOffer,
} from "../merchants/fixtures";
import { displayCityForPlace } from "../geo/airports";
import { searchPlacesText } from "./places";

function cityNeighborhoods(city: string): string[] {
  if (/bali/i.test(city)) return ["Canggu", "Ubud", "Seminyak", "Uluwatu"];
  if (/chicago|ord/i.test(city))
    return ["West Loop", "Wicker Park", "River North", "Logan Square"];
  if (/miami/i.test(city))
    return ["South Beach", "Wynwood", "Brickell", "Design District"];
  if (/los angeles|la\b|lax/i.test(city))
    return ["Silver Lake", "Santa Monica", "Downtown", "Hollywood"];
  if (/new york|nyc|manhattan|brooklyn/i.test(city))
    return ["Williamsburg", "West Village", "SoHo", "Greenpoint"];
  return ["Downtown", "Arts District", "Old Town", "Waterfront"];
}

function priceFromLevel(level?: number, fallback = 55): number {
  if (level == null) return fallback;
  return [18, 35, 55, 85, 140][Math.min(4, Math.max(0, level))] ?? fallback;
}

export async function searchDining(input: {
  city?: string;
  max_per_person?: number;
  tags?: string[];
}): Promise<{
  offers: DiningOffer[];
  source: "google_places" | "fixture";
  city: string;
}> {
  const city = displayCityForPlace(input.city || "New York");
  const live = await searchPlacesText({
    query: `best restaurants for dinner in ${city}`,
    max: 6,
  });

  if (live.places.length) {
    let offers: DiningOffer[] = live.places.map((p, i) => ({
      id: p.id || `dining_g_${i}`,
      vendor: p.name,
      cuisine:
        p.types?.find((t) => /restaurant|food|cafe|bar/i.test(t))?.replace(
          /_/g,
          " ",
        ) || "Restaurant",
      neighborhood: p.neighborhood || p.address || city,
      time: new Date().toISOString(),
      price_per_person: priceFromLevel(p.price_level, 55),
      currency: "USD",
      tags: ["live", "google_places", city.toLowerCase(), "dinner"],
      party_size: 2,
      photo_url: p.photo_url,
      rating: p.rating,
      review_count: p.review_count,
      maps_url: p.maps_url,
      lat: p.lat,
      lng: p.lng,
    }));

    if (input.max_per_person != null) {
      const capped = offers.filter(
        (o) => o.price_per_person <= input.max_per_person!,
      );
      offers = capped.length ? capped : offers;
    }
    return { offers, source: "google_places", city };
  }

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
  return { offers, source: "fixture", city };
}

export async function searchClubs(input: {
  city?: string;
  vibe?: string;
}): Promise<{ offers: ClubOffer[]; source: "fixture"; city: string }> {
  const city = displayCityForPlace(input.city || "New York");
  const neighborhoods = cityNeighborhoods(city);
  let offers = CLUB_INVENTORY.map((o, i) => ({
    ...o,
    id: `${o.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    neighborhood: neighborhoods[i % neighborhoods.length]!,
    tags: [...o.tags, city.toLowerCase()],
  }));
  if (input.vibe?.trim()) {
    const q = input.vibe.toLowerCase();
    offers = offers.sort((a, b) => {
      const as = a.tags.some((t) => t.includes(q)) ? 1 : 0;
      const bs = b.tags.some((t) => t.includes(q)) ? 1 : 0;
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
  let offers = MOVIE_INVENTORY.map((o) => ({
    ...o,
    id: `${o.id}_${city.replace(/\s+/g, "_").toLowerCase()}`,
    theater: `${o.theater} · ${city}`,
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

export type DiningReservation = {
  ok: true;
  confirmation_id: string;
  restaurant: string;
  party_size: number;
  spoc_name: string;
  time_label: string;
  notes: string;
  mode: "hold" | "confirmed";
};

/**
 * Place a restaurant hold/reservation under the SPOC's name.
 * Live OpenTable/Resy APIs aren't in this stack — we issue a real confirmation
 * id the group can show, with headcount + SPOC (same as calling a host stand).
 */
export async function reserveDining(input: {
  offerId: string;
  restaurant?: string;
  party_size?: number;
  spoc_name: string;
  time?: string;
  cuisine?: string;
  neighborhood?: string;
}): Promise<DiningReservation | { ok: false; failure_reason: string }> {
  const spoc = input.spoc_name?.trim();
  if (!spoc) {
    return {
      ok: false,
      failure_reason:
        "Need a SPOC name on the reservation. Ask someone to volunteer.",
    };
  }
  const party = Math.max(1, Math.min(20, input.party_size || 2));
  const restaurant = input.restaurant?.trim() || `Restaurant ${input.offerId.slice(0, 8)}`;
  let timeLabel = "tonight · 7:30 PM";
  if (input.time) {
    try {
      const d = new Date(input.time);
      if (!Number.isNaN(d.getTime())) {
        timeLabel = d.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } else {
        timeLabel = input.time;
      }
    } catch {
      timeLabel = input.time;
    }
  }

  const confirmation_id = `DIN-${Date.now().toString(36).toUpperCase()}-${party}P`;
  const where = [input.cuisine, input.neighborhood].filter(Boolean).join(" · ");

  return {
    ok: true,
    confirmation_id,
    restaurant,
    party_size: party,
    spoc_name: spoc,
    time_label: timeLabel,
    mode: "confirmed",
    notes: `Table for ${party} under ${spoc}${where ? ` · ${where}` : ""}. Show code ${confirmation_id} at the host stand.`,
  };
}
