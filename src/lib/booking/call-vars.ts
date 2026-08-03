import type { BookingCallSession } from "./call-session";

/**
 * Every `{{placeholder}}` the booking / reservation prompts may reference.
 *
 * ElevenLabs resolves `{{name}}` against dynamic_variables at call start.
 * Any placeholder left undefined kills the conversation the moment it
 * connects — Twilio 31921 WebSocket teardown at 0–1s. Looks like a carrier
 * drop; isn't.
 *
 * Always send the FULL set (with safe string defaults). Flight and restaurant
 * paths share one booking agent, so a restaurant dial still has to satisfy
 * every flight placeholder left in the dashboard prompt, and vice versa.
 *
 * Prefer baking the system prompt at dial time (see placeElevenAgentsOutbound
 * `system_prompt`) so we don't depend on placeholder substitution at all.
 * Keep this map as the safety net for tools (`session_id`) and leftover
 * dashboard `{{…}}` text.
 */
export const BOOKING_DYNAMIC_VAR_KEYS = [
  "session_id",
  "carrier",
  "flight_number",
  "origin",
  "destination",
  "departing_at",
  "amount",
  "currency",
  "given_name",
  "family_name",
  "born_on",
  "email",
  "phone_number",
  "cabin",
  "checked_bags",
  "seat_preference",
  "estimated_extras_cost",
  "airline_phone",
  "merchant_name",
  "category",
  "request",
  "party_size",
  "when",
  "requirements",
] as const;

const EMPTY_DEFAULTS: Record<(typeof BOOKING_DYNAMIC_VAR_KEYS)[number], string> = {
  session_id: "",
  carrier: "the merchant",
  flight_number: "n/a",
  origin: "n/a",
  destination: "n/a",
  departing_at: "n/a",
  amount: "0",
  currency: "USD",
  given_name: "the customer",
  family_name: "",
  born_on: "n/a",
  email: "n/a",
  phone_number: "n/a",
  cabin: "standard",
  checked_bags: "0",
  seat_preference: "no preference",
  estimated_extras_cost: "0.00",
  airline_phone: "n/a",
  merchant_name: "the merchant",
  category: "other",
  request: "a booking",
  party_size: "not specified",
  when: "not specified",
  requirements: "none",
};

/** Merge caller values onto the full default set. Every value is a string. */
export function completeDynamicVariables(
  partial: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = { ...EMPTY_DEFAULTS };
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined || value === null) continue;
    const s = String(value);
    // Empty string still counts as "defined" for ElevenLabs — keep it when
    // the caller intentionally cleared a field (e.g. no surname).
    out[key] = s;
  }
  // Never leave session_id as the empty default if somehow omitted — tools
  // key off it. Prefer a sentinel over undefined.
  if (!out.session_id) out.session_id = "unknown";
  return out;
}

export function callDynamicVariables(s: BookingCallSession): Record<string, string> {
  const f = s.flight;
  const p = s.passenger;
  const x = s.extras;

  return completeDynamicVariables({
    session_id: s.id,

    carrier: f.carrier || "the airline",
    flight_number: f.flight_number || "n/a",
    origin: f.origin || "n/a",
    destination: f.destination || "n/a",
    departing_at: f.departing_at || "n/a",
    amount: f.amount || "0",
    currency: f.currency || "USD",

    given_name: p.given_name || "the traveller",
    family_name: p.family_name || "",
    born_on: p.born_on || "n/a",
    email: p.email || "n/a",
    phone_number: p.phone_number || "n/a",

    cabin: x.cabin || "economy",
    checked_bags: String(x.checked_bags ?? 0),
    seat_preference: x.seat_preference ?? "no preference",
    estimated_extras_cost: x.estimated_extras_cost || "0.00",

    airline_phone: s.airline_phone || "n/a",

    // Aliases so a restaurant-shaped dashboard prompt still resolves.
    merchant_name: f.carrier || "the airline",
    category: "airline",
    request: `book ${f.flight_number || "a flight"} ${f.origin || ""} to ${f.destination || ""}`.trim(),
    party_size: "1",
    when: f.departing_at || "n/a",
    requirements: x.seat_preference || "none",
  });
}
