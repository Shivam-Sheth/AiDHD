/**
 * Google Places Text Search (New) — restaurants / nightlife when GOOGLE_MAPS_API is set.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

import { hasGoogleMaps } from "./config";

export type PlaceHit = {
  id: string;
  name: string;
  address?: string;
  neighborhood?: string;
  rating?: number;
  review_count?: number;
  price_level?: number;
  photo_url?: string | null;
  maps_url?: string;
  types?: string[];
  lat?: number;
  lng?: number;
};

function mapsKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API || process.env.GOOGLE_MAPS_API_KEY;
}

function photoUrl(name?: string): string | null {
  const key = mapsKey();
  if (!name || !key) return null;
  return `https://places.googleapis.com/v1/${name}/media?maxHeightPx=480&key=${key}`;
}

export async function searchPlacesText(input: {
  query: string;
  max?: number;
}): Promise<{ places: PlaceHit[]; source: "google_places" | "none" }> {
  const key = mapsKey();
  if (!hasGoogleMaps() || !key) {
    return { places: [], source: "none" };
  }

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.googleMapsUri,places.types,places.location,places.shortFormattedAddress",
        },
        body: JSON.stringify({
          textQuery: input.query,
          pageSize: Math.min(input.max ?? 6, 8),
        }),
      },
    );
    if (!res.ok) {
      console.error("[places] searchText", res.status, await res.text());
      return { places: [], source: "none" };
    }
    const json = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        shortFormattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        photos?: Array<{ name?: string }>;
        googleMapsUri?: string;
        types?: string[];
        location?: { latitude?: number; longitude?: number };
      }>;
    };

    const priceMap: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };

    const places: PlaceHit[] = (json.places || []).map((p, i) => ({
      id: p.id || `place_${i}`,
      name: p.displayName?.text || "Place",
      address: p.formattedAddress,
      neighborhood: p.shortFormattedAddress || p.formattedAddress,
      rating: p.rating,
      review_count: p.userRatingCount,
      price_level: p.priceLevel ? priceMap[p.priceLevel] : undefined,
      photo_url: photoUrl(p.photos?.[0]?.name),
      maps_url: p.googleMapsUri,
      types: p.types,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    }));

    return { places, source: places.length ? "google_places" : "none" };
  } catch (err) {
    console.error("[places] failed", err);
    return { places: [], source: "none" };
  }
}
