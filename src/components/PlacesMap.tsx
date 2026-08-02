"use client";

import { useEffect, useRef, useState } from "react";

/**
 * No @types/google.maps in this project — the Maps JS SDK attaches `google`
 * to window at runtime, so we type it loosely rather than pull in a new dep.
 */
type GoogleNamespace = typeof globalThis & { google?: any };

export type PlaceReview = { author: string; text: string; rating?: number };

export type ResolvedPlaceInfo = {
  placeId: string | null;
  lat: number;
  lng: number;
  /** First 2 of whatever Google returns (Places API caps reviews at 5 per place). */
  reviews: PlaceReview[];
};

export type RouteInfoPayload = {
  place: string;
  drive_minutes: number | null;
  walk_minutes: number | null;
  bike_minutes: number | null;
  transit_minutes: number | null;
  maps_url: string;
};

export type MapPlace = {
  id: string;
  label: string;
  /** Free-text address/query handed to the Geocoding API. */
  query: string;
  /** The one place (the chosen hotel) the map resets around and routes from. */
  isAnchor?: boolean;
};

type Props = {
  apiKey: string | null;
  places: MapPlace[];
  hoveredId: string | null;
  /** DemoApp is light-themed, the live concierge page is dark — pick the matching chrome. */
  variant?: "light" | "dark";
  /** Fired once per place after geocode + reviews fetch resolve. */
  onResolved?: (id: string, info: ResolvedPlaceInfo) => void;
  /** Fired on hover change once hotel → place route data is ready, or null when there's nothing to show. */
  onRouteInfo?: (info: RouteInfoPayload | null) => void;
};

type MarkerEntry = {
  marker: any;
  position: { lat: number; lng: number };
  isAnchor: boolean;
};

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const BASE_SCALE = 8;
const HOVER_SCALE = 15;

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  const win = window as GoogleNamespace;
  if (win.google?.maps?.places) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JS SDK"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function geocodeOnce(
  geocoder: any,
  query: string,
): Promise<{ lat: number; lng: number; placeId: string | null } | null> {
  return new Promise((resolve) => {
    geocoder.geocode(
      { address: query },
      (results: any[] | null, status: string) => {
        const hit = results?.[0];
        if (status !== "OK" || !hit) return resolve(null);
        const loc = hit.geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng(), placeId: hit.place_id || null });
      },
    );
  });
}

/** New Place class (fetchFields) — PlacesService.getDetails is the deprecated path. */
async function fetchReviews(placeId: string): Promise<PlaceReview[]> {
  const google = (window as GoogleNamespace).google;
  if (!google?.maps?.places?.Place) return [];
  try {
    const place = new google.maps.places.Place({ id: placeId });
    await place.fetchFields({ fields: ["reviews"] });
    const reviews = (place.reviews || []) as Array<{
      text?: string;
      rating?: number;
      authorAttribution?: { displayName?: string };
    }>;
    return reviews.slice(0, 2).map((r) => ({
      author: r.authorAttribution?.displayName || "Google user",
      text: r.text || "",
      rating: r.rating,
    }));
  } catch {
    return [];
  }
}

async function resolvePlaceExtras(
  place: MapPlace,
  pos: { lat: number; lng: number; placeId: string | null },
  resolvedRef: React.MutableRefObject<Set<string>>,
  onResolved: (id: string, info: ResolvedPlaceInfo) => void,
) {
  if (resolvedRef.current.has(place.id)) return;
  resolvedRef.current.add(place.id);
  const reviews = pos.placeId ? await fetchReviews(pos.placeId) : [];
  onResolved(place.id, { placeId: pos.placeId, lat: pos.lat, lng: pos.lng, reviews });
}

function fitToMarkers(map: any, markers: Map<string, MarkerEntry>) {
  const google = (window as GoogleNamespace).google;
  if (!google || markers.size === 0) return;
  const bounds = new google.maps.LatLngBounds();
  for (const entry of markers.values()) bounds.extend(entry.position);
  map.fitBounds(bounds, 60);
}

async function syncMarkers(ctx: {
  places: MapPlace[];
  map: any;
  geocoder: any;
  markers: Map<string, MarkerEntry>;
  anchorAppliedIdRef: React.MutableRefObject<string | null>;
  resolvedRef: React.MutableRefObject<Set<string>>;
  onResolved: (id: string, info: ResolvedPlaceInfo) => void;
}) {
  const { places, map, geocoder, markers, anchorAppliedIdRef, resolvedRef, onResolved } = ctx;
  if (!map || !geocoder) return;
  const google = (window as GoogleNamespace).google;

  const currentIds = new Set(places.map((p) => p.id));
  for (const [id, entry] of markers) {
    if (!currentIds.has(id)) {
      entry.marker.setMap(null);
      markers.delete(id);
    }
  }

  const anchor = places.find((p) => p.isAnchor);

  // First sighting of a (new) chosen hotel — wipe the board and center on it alone.
  if (anchor && anchorAppliedIdRef.current !== anchor.id) {
    for (const entry of markers.values()) entry.marker.setMap(null);
    markers.clear();
    resolvedRef.current.delete(anchor.id);
    anchorAppliedIdRef.current = anchor.id;

    const pos = await geocodeOnce(geocoder, anchor.query);
    if (pos) {
      const marker = new google.maps.Marker({
        position: { lat: pos.lat, lng: pos.lng },
        map,
        title: anchor.label,
        zIndex: 500,
        // Deliberately no custom icon — the stock red pin is the "special" hotel marker.
      });
      markers.set(anchor.id, {
        marker,
        position: { lat: pos.lat, lng: pos.lng },
        isAnchor: true,
      });
      map.setCenter({ lat: pos.lat, lng: pos.lng });
      map.setZoom(15);
      void resolvePlaceExtras(anchor, pos, resolvedRef, onResolved);
    }
  }

  for (const place of places) {
    if (place.isAnchor || markers.has(place.id)) continue;
    void (async () => {
      const pos = await geocodeOnce(geocoder, place.query);
      if (!pos || markers.has(place.id)) return;
      const marker = new google.maps.Marker({
        position: { lat: pos.lat, lng: pos.lng },
        map,
        title: place.label,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: BASE_SCALE,
          fillColor: "#0f766e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markers.set(place.id, {
        marker,
        position: { lat: pos.lat, lng: pos.lng },
        isAnchor: false,
      });
      fitToMarkers(map, markers);
      void resolvePlaceExtras(place, pos, resolvedRef, onResolved);
    })();
  }
}

async function syncRoute(ctx: {
  hoveredId: string | null;
  places: MapPlace[];
  markers: Map<string, MarkerEntry>;
  map: any;
  polyline: any;
  cache: Map<string, RouteInfoPayload>;
  latestHoverRef: React.MutableRefObject<string | null>;
  onRouteInfo: (info: RouteInfoPayload | null) => void;
}) {
  const { hoveredId, places, markers, map, polyline, cache, latestHoverRef, onRouteInfo } = ctx;
  const google = (window as GoogleNamespace).google;
  const anchor = places.find((p) => p.isAnchor);
  const anchorEntry = anchor ? markers.get(anchor.id) : undefined;
  const hoveredEntry = hoveredId ? markers.get(hoveredId) : undefined;
  const hoveredPlace = hoveredId ? places.find((p) => p.id === hoveredId) : undefined;

  if (!hoveredId || !anchor || !anchorEntry || hoveredId === anchor.id || !hoveredEntry || !hoveredPlace) {
    polyline?.setMap(null);
    onRouteInfo(null);
    return;
  }

  const cached = cache.get(hoveredId);
  if (cached) onRouteInfo(cached);

  try {
    const res = await fetch("/api/agent/route-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: anchorEntry.position,
        destination: hoveredEntry.position,
      }),
    });
    const data = await res.json();
    if (latestHoverRef.current !== hoveredId || !data.ok) return;

    const payload: RouteInfoPayload = {
      place: hoveredPlace.label,
      drive_minutes: data.drive_minutes,
      walk_minutes: data.walk_minutes,
      bike_minutes: data.bike_minutes,
      transit_minutes: data.transit_minutes,
      maps_url: data.maps_url,
    };
    cache.set(hoveredId, payload);
    onRouteInfo(payload);

    if (data.polyline && google?.maps?.geometry?.encoding && polyline) {
      const path = google.maps.geometry.encoding.decodePath(data.polyline);
      polyline.setPath(path);
      polyline.setMap(map);
    } else {
      polyline?.setMap(null);
    }
  } catch {
    if (latestHoverRef.current === hoveredId) {
      polyline?.setMap(null);
      onRouteInfo(null);
    }
  }
}

/**
 * Single shared map — recommended places accumulate as packages come in; the
 * chosen hotel becomes a fixed red anchor the first time it appears; hovering
 * a place card grows its pin and draws the hotel → place route.
 */
export function PlacesMap({
  apiKey,
  places,
  hoveredId,
  variant = "light",
  onResolved,
  onRouteInfo,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const anchorAppliedIdRef = useRef<string | null>(null);
  const polylineRef = useRef<any>(null);
  const routeCacheRef = useRef<Map<string, RouteInfoPayload>>(new Map());
  const resolvedRef = useRef<Set<string>>(new Set());
  const latestHoverRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const onRouteInfoRef = useRef(onRouteInfo);
  onRouteInfoRef.current = onRouteInfo;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as GoogleNamespace).google;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        geocoderRef.current = new google.maps.Geocoder();
        polylineRef.current = new google.maps.Polyline({
          strokeColor: "#ef4444",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        });
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!ready) return;
    void syncMarkers({
      places,
      map: mapRef.current,
      geocoder: geocoderRef.current,
      markers: markersRef.current,
      anchorAppliedIdRef,
      resolvedRef,
      onResolved: (id, info) => onResolvedRef.current?.(id, info),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places]);

  useEffect(() => {
    latestHoverRef.current = hoveredId;

    for (const [id, entry] of markersRef.current) {
      if (entry.isAnchor) continue;
      const hovered = id === hoveredId;
      const icon = entry.marker.getIcon();
      entry.marker.setIcon({ ...icon, scale: hovered ? HOVER_SCALE : BASE_SCALE });
      entry.marker.setZIndex(hovered ? 999 : 1);
    }

    void syncRoute({
      hoveredId,
      places,
      markers: markersRef.current,
      map: mapRef.current,
      polyline: polylineRef.current,
      cache: routeCacheRef.current,
      latestHoverRef,
      onRouteInfo: (info) => onRouteInfoRef.current?.(info),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  if (!apiKey) {
    return (
      <div
        className={
          variant === "dark"
            ? "flex h-72 w-full items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-center text-xs text-white/40"
            : "flex h-72 w-full items-center justify-center rounded-2xl border border-dashed border-line-strong bg-subtle px-4 text-center text-xs text-muted"
        }
      >
        Add GOOGLE_MAPS_API to .env.local to show recommended places on a map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        variant === "dark"
          ? "h-72 w-full rounded-3xl border border-white/10"
          : "h-72 w-full rounded-2xl border border-line bg-subtle"
      }
    />
  );
}
