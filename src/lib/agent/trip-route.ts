import type { Event, Response } from "../types";
import {
  airportCodeForPlace,
  displayCityForPlace,
  tagValue,
} from "../geo/airports";

export type TripRoute = {
  originCode: string;
  destCode: string;
  originCity: string;
  destCity: string;
};

function allTags(responses: Response[]): string[] {
  const tags = new Set<string>();
  for (const r of responses) {
    for (const t of r.preferences.structured_tags) tags.add(t);
  }
  return [...tags];
}

/**
 * Resolve origin→destination from user prefs — never silent JFK/MIA.
 */
export function resolveTripRoute(
  responses: Response[],
  event?: Event,
): TripRoute {
  const tags = allTags(responses);

  const originCityRaw =
    responses.map((r) => r.preferences.origin_city).find(Boolean) ||
    tagValue(tags, "origin_city:") ||
    null;

  const destCityRaw =
    responses.map((r) => r.preferences.destination).find(Boolean) ||
    tagValue(tags, "destination:") ||
    (event?.destination_or_venue &&
    !/miami beach/i.test(event.destination_or_venue)
      ? event.destination_or_venue
      : null) ||
    null;

  const originFromTag = tagValue(tags, "origin:");
  const destFromTag = tagValue(tags, "dest:");

  const originCode =
    (originFromTag && /^[A-Za-z]{3}$/.test(originFromTag)
      ? originFromTag.toUpperCase()
      : null) ||
    (originCityRaw ? airportCodeForPlace(originCityRaw) : null);

  const destCode =
    (destFromTag && /^[A-Za-z]{3}$/.test(destFromTag)
      ? destFromTag.toUpperCase()
      : null) ||
    (destCityRaw ? airportCodeForPlace(destCityRaw) : null);

  if (!originCode || !destCode) {
    throw new Error(
      `Missing flight route — need origin + destination cities (got origin=${originCityRaw ?? "?"} dest=${destCityRaw ?? "?"} codes=${originCode ?? "?"}→${destCode ?? "?"}). Re-send TRIP prefs.`,
    );
  }

  if (originCode === destCode) {
    throw new Error(
      `Origin and destination are the same airport (${originCode}). Pick a different destination.`,
    );
  }

  return {
    originCode,
    destCode,
    originCity: originCityRaw
      ? displayCityForPlace(originCityRaw)
      : originCode,
    destCity: destCityRaw ? displayCityForPlace(destCityRaw) : destCode,
  };
}

/** Departure date for Duffel from group availability. */
export function resolveDepartDate(
  responses: Response[],
  event?: Event,
): string {
  const dates = responses
    .flatMap((r) => r.availability)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates[0]) return dates[0];
  const proposed = event?.proposed_dates?.filter((d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d),
  );
  if (proposed?.[0]) return proposed[0];
  return "2026-08-14";
}

export function resolveReturnDate(
  responses: Response[],
  event?: Event,
  depart?: string,
): string {
  const dates = responses
    .flatMap((r) => r.availability)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length >= 2) return dates[dates.length - 1]!;
  const d = depart || resolveDepartDate(responses, event);
  const dt = new Date(`${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 2);
  return dt.toISOString().slice(0, 10);
}
