"use client";

import { useEffect, useRef, useState } from "react";

/**
 * No @types/google.maps in this project — the Maps JS SDK attaches `google`
 * to window at runtime, so we type it loosely rather than pull in a new dep.
 */
type GoogleNamespace = typeof globalThis & { google?: any };

export type MapPlace = {
  id: string;
  label: string;
  /** Free-text address/query handed to the Geocoding API. */
  query: string;
};

type Props = {
  apiKey: string | null;
  places: MapPlace[];
  hoveredId: string | null;
  /** DemoApp is light-themed, the live concierge page is dark — pick the matching chrome. */
  variant?: "light" | "dark";
};

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const BASE_SCALE = 8;
const HOVER_SCALE = 15;

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  const win = window as GoogleNamespace;
  if (win.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JS SDK"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/** Single shared map — recommended places accumulate as packages come in; hovering a place card grows its pin. */
export function PlacesMap({ apiKey, places, hoveredId, variant = "light" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);

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
    syncMarkers(places, mapRef.current, geocoderRef.current, markersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places]);

  useEffect(() => {
    const google = (window as GoogleNamespace).google;
    if (!google) return;
    for (const [id, marker] of markersRef.current) {
      const hovered = id === hoveredId;
      const icon = marker.getIcon();
      marker.setIcon({
        ...icon,
        scale: hovered ? HOVER_SCALE : BASE_SCALE,
      });
      marker.setZIndex(hovered ? 999 : 1);
    }
  }, [hoveredId]);

  if (!apiKey) {
    return (
      <div
        className={
          variant === "dark"
            ? "flex h-72 w-full items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-center text-xs text-white/40"
            : "flex h-72 w-full items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center text-xs text-neutral-500"
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
          : "h-72 w-full rounded-2xl border border-neutral-200 bg-neutral-100"
      }
    />
  );
}

function syncMarkers(
  places: MapPlace[],
  map: any,
  geocoder: any,
  markers: Map<string, any>,
) {
  if (!map || !geocoder) return;
  const google = (window as GoogleNamespace).google;

  const currentIds = new Set(places.map((p) => p.id));
  for (const [id, marker] of markers) {
    if (!currentIds.has(id)) {
      marker.setMap(null);
      markers.delete(id);
    }
  }

  for (const place of places) {
    if (markers.has(place.id)) continue;
    geocoder.geocode(
      { address: place.query },
      (results: any[], status: string) => {
        if (status !== "OK" || !results?.[0]) return;
        const marker = new google.maps.Marker({
          position: results[0].geometry.location,
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
        markers.set(place.id, marker);
        fitToMarkers(map, markers);
      },
    );
  }
}

function fitToMarkers(map: any, markers: Map<string, any>) {
  const google = (window as GoogleNamespace).google;
  if (!google || markers.size === 0) return;
  const bounds = new google.maps.LatLngBounds();
  for (const marker of markers.values()) bounds.extend(marker.getPosition());
  map.fitBounds(bounds, 60);
}
