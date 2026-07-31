import { hasGoogleMaps } from "./config";

export type LatLng = { lat: number; lng: number };

export type RouteInfo = {
  drive_minutes: number | null;
  walk_minutes: number | null;
  bike_minutes: number | null;
  transit_minutes: number | null;
  /** Encoded polyline for the drive route — decode client-side to draw the line. */
  polyline: string | null;
  maps_url: string;
  source: "google" | "fixture";
};

type TravelMode = "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT";

async function computeRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  wantPolyline: boolean,
): Promise<{ minutes: number | null; polyline: string | null }> {
  const key = process.env.GOOGLE_MAPS_API;
  if (!key) return { minutes: null, polyline: null };
  try {
    const fieldMask = wantPolyline
      ? "routes.duration,routes.polyline.encodedPolyline"
      : "routes.duration";
    const body: Record<string, unknown> = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: mode,
      units: "IMPERIAL",
    };
    // routingPreference is only valid for DRIVE (and TWO_WHEELER) — omit elsewhere.
    if (mode === "DRIVE") body.routingPreference = "TRAFFIC_AWARE";

    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json()) as {
      routes?: Array<{
        duration?: string;
        polyline?: { encodedPolyline?: string };
      }>;
    };
    const route = data.routes?.[0];
    if (!route) return { minutes: null, polyline: null };
    const seconds = Number(String(route.duration || "").replace(/s$/, ""));
    return {
      minutes: Number.isFinite(seconds) ? Math.round(seconds / 60) : null,
      polyline: route.polyline?.encodedPolyline || null,
    };
  } catch {
    return { minutes: null, polyline: null };
  }
}

function mapsUrl(origin: LatLng, destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

/**
 * Hotel → suggested-place route, all four modes. Routes API (the Directions/
 * Distance Matrix JS services were deprecated Feb 2026) — one request per mode.
 */
export async function getRouteInfo(
  origin: LatLng,
  destination: LatLng,
): Promise<RouteInfo> {
  if (!hasGoogleMaps()) {
    return {
      drive_minutes: 18,
      walk_minutes: 55,
      bike_minutes: 22,
      transit_minutes: 30,
      polyline: null,
      maps_url: mapsUrl(origin, destination),
      source: "fixture",
    };
  }

  const [drive, walk, bike, transit] = await Promise.all([
    computeRoute(origin, destination, "DRIVE", true),
    computeRoute(origin, destination, "WALK", false),
    computeRoute(origin, destination, "BICYCLE", false),
    computeRoute(origin, destination, "TRANSIT", false),
  ]);

  return {
    drive_minutes: drive.minutes,
    walk_minutes: walk.minutes,
    bike_minutes: bike.minutes,
    transit_minutes: transit.minutes,
    polyline: drive.polyline,
    maps_url: mapsUrl(origin, destination),
    source: "google",
  };
}
