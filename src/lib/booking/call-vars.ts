import type { BookingCallSession } from "./call-session";

/**
 * Every `{{placeholder}}` the booking prompt references.
 *
 * ElevenLabs resolves `{{name}}` in a system prompt against the dynamic
 * variables supplied when the call is placed. Any placeholder left undefined
 * kills the conversation the moment it starts — it shows up as a Twilio 31921
 * WebSocket teardown at 0-1s, which looks like a carrier problem but isn't.
 *
 * If you add a placeholder to call-script.ts, add it here too.
 */
export function callDynamicVariables(s: BookingCallSession): Record<string, string> {
  const f = s.flight;
  const p = s.passenger;
  const x = s.extras;

  return {
    session_id: s.id,

    carrier: f.carrier || "the airline",
    flight_number: f.flight_number || "",
    origin: f.origin || "",
    destination: f.destination || "",
    departing_at: f.departing_at || "",
    amount: f.amount || "",
    currency: f.currency || "USD",

    given_name: p.given_name,
    family_name: p.family_name,
    born_on: p.born_on,
    email: p.email,
    phone_number: p.phone_number,

    cabin: x.cabin,
    checked_bags: String(x.checked_bags),
    seat_preference: x.seat_preference ?? "no preference",
    estimated_extras_cost: x.estimated_extras_cost,

    airline_phone: s.airline_phone,
  };
}
