import { hasGoogleMaps } from "./config";

export type WeatherResult = {
  mode: "forecast" | "current";
  place: string;
  /** ISO date this reading corresponds to — the travel date for a forecast, today for current conditions. */
  date: string;
  condition: string;
  icon_url: string | null;
  temp_high?: number;
  temp_low?: number;
  temperature?: number;
  unit: "F";
  extreme: boolean;
  source: "google" | "fixture";
};

/** Google Weather API `type` enum isn't fully published — flag anything storm/severe-shaped as extreme. */
const EXTREME_TYPE_RE =
  /THUNDERSTORM|HEAVY|STORM|TORNADO|HURRICANE|CYCLONE|BLIZZARD|HAIL|SEVERE|EXTREME|FREEZING/i;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole-day difference between an ISO date and today, in UTC calendar days. */
function daysUntil(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}

async function geocode(place: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place)}&key=${key}`,
    );
    const data = (await res.json()) as {
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    };
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

function isExtreme(condType: string | undefined, extraSignals: number[]): boolean {
  if (EXTREME_TYPE_RE.test(condType || "")) return true;
  return extraSignals.some((n) => n >= 60);
}

function fixtureWeather(
  place: string,
  date: string,
  mode: "forecast" | "current",
): WeatherResult {
  return {
    mode,
    place,
    date,
    condition: "Partly cloudy",
    icon_url: null,
    temp_high: 78,
    temp_low: 64,
    temperature: 72,
    unit: "F",
    extreme: false,
    source: "fixture",
  };
}

/**
 * Weather for the first day of travel — Google's forecast endpoint only covers
 * ~10 days out, so beyond that we show current conditions instead (disclosed
 * in the result) rather than fabricate a forecast the API can't actually give.
 */
export async function getWeatherForTravel(
  place: string,
  dateIso: string,
): Promise<WeatherResult> {
  if (!hasGoogleMaps()) return fixtureWeather(place, dateIso, "forecast");

  const coords = await geocode(place);
  if (!coords) return fixtureWeather(place, dateIso, "forecast");

  const key = process.env.GOOGLE_MAPS_API;
  const offset = daysUntil(dateIso);

  if (offset >= 0 && offset <= 10) {
    try {
      const res = await fetch(
        `https://weather.googleapis.com/v1/forecast/days:lookup?key=${key}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&days=11&unitsSystem=IMPERIAL`,
      );
      const data = (await res.json()) as {
        forecastDays?: Array<{
          displayDate: { year: number; month: number; day: number };
          daytimeForecast?: {
            weatherCondition?: {
              type?: string;
              description?: { text?: string };
              iconBaseUri?: string;
            };
            thunderstormProbability?: number;
            precipitation?: { probability?: { percent?: number } };
          };
          maxTemperature?: { degrees?: number };
          minTemperature?: { degrees?: number };
        }>;
      };
      const day = (data.forecastDays || []).find((d) => {
        const iso = `${d.displayDate.year}-${String(d.displayDate.month).padStart(2, "0")}-${String(d.displayDate.day).padStart(2, "0")}`;
        return iso === dateIso;
      });
      if (day) {
        const cond = day.daytimeForecast?.weatherCondition;
        return {
          mode: "forecast",
          place,
          date: dateIso,
          condition: cond?.description?.text || "Unknown",
          icon_url: cond?.iconBaseUri ? `${cond.iconBaseUri}.png` : null,
          temp_high: day.maxTemperature?.degrees,
          temp_low: day.minTemperature?.degrees,
          unit: "F",
          extreme: isExtreme(cond?.type, [
            day.daytimeForecast?.thunderstormProbability ?? 0,
            day.daytimeForecast?.precipitation?.probability?.percent ?? 0,
          ]),
          source: "google",
        };
      }
    } catch {
      // fall through to fixture below
    }
    return fixtureWeather(place, dateIso, "forecast");
  }

  // Travel date is more than 10 days out — Google can't forecast that far, show current conditions.
  try {
    const res = await fetch(
      `https://weather.googleapis.com/v1/currentConditions:lookup?key=${key}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&unitsSystem=IMPERIAL`,
    );
    const data = (await res.json()) as {
      weatherCondition?: {
        type?: string;
        description?: { text?: string };
        iconBaseUri?: string;
      };
      temperature?: { degrees?: number };
      thunderstormProbability?: number;
      precipitation?: { probability?: { percent?: number } };
    };
    const cond = data.weatherCondition;
    return {
      mode: "current",
      place,
      date: todayIso(),
      condition: cond?.description?.text || "Unknown",
      icon_url: cond?.iconBaseUri ? `${cond.iconBaseUri}.png` : null,
      temperature: data.temperature?.degrees,
      unit: "F",
      extreme: isExtreme(cond?.type, [
        data.thunderstormProbability ?? 0,
        data.precipitation?.probability?.percent ?? 0,
      ]),
      source: "google",
    };
  } catch {
    return fixtureWeather(place, todayIso(), "current");
  }
}
