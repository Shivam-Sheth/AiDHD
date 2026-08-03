import type { MerchantCategory } from "./merchant-lookup";
import { completeDynamicVariables } from "./call-vars";

/**
 * Call script for non-flight bookings — restaurants, hotels, venues, stores.
 *
 * Same two rules as the flight script and for the same reasons:
 *  1. AI disclosure in the first line. California SB 1001 covers bots that
 *     incentivise a commercial transaction; EU AI Act Art. 50 requires
 *     disclosure to anyone the system interacts with.
 *  2. No card details in the prompt. The agent calls `get_payment_card`, which
 *     refuses until the payment mandate is approved.
 */

export type ReservationBrief = {
  category: MerchantCategory;
  merchant_name: string;
  /** Free-text of what's wanted: "table for 4, Friday 8pm, one vegetarian". */
  request: string;
  party_size: number | null;
  when: string | null;
  /** Dietary needs, accessibility, room type, seat preference, etc. */
  requirements: string[];
  /** Null when nothing is being paid on the call — availability checks etc. */
  budget: { amount: string; currency: string } | null;
  contact: { name: string; phone: string; email: string };
};

const OPENERS: Record<MerchantCategory, string> = {
  restaurant: "I'd like to make a reservation",
  hotel: "I'd like to enquire about a room",
  airline: "I'd like to book a flight",
  event_venue: "I'd like to ask about tickets",
  ticket_provider: "I'd like to ask about tickets",
  store: "I'd like to ask about an item",
  customer_support: "I have a question about an order",
  other: "I'd like to make a booking",
};

export function reservationFirstMessage(b: ReservationBrief): string {
  return (
    `Hi, this is an AI assistant calling on behalf of ${b.contact.name}, on a recorded line. ` +
    `${OPENERS[b.category]} — do you have a moment to help?`
  );
}

export function reservationPrompt(b: ReservationBrief): string {
  const paying = b.budget !== null;

  return `You are a booking assistant calling ${b.merchant_name} on behalf of a customer. You are speaking to a human.

## Disclosure — never skip or soften this
You opened by identifying yourself as an AI assistant on a recorded line. If asked again, say plainly: "Yes — I'm an AI assistant calling on behalf of ${b.contact.name}." Never claim to be a human. Never claim to be the customer. If they say they cannot deal with an automated caller, thank them, ask whether someone can call back, and end politely.

## What you are asking for
${b.request}
${b.party_size ? `Party size: ${b.party_size}` : ""}
${b.when ? `When: ${b.when}` : ""}
${b.requirements.length ? `Requirements: ${b.requirements.join("; ")}` : ""}

State these clearly. If the exact time is unavailable, ask what IS available nearby and report back — do not accept a materially different slot on your own. Requirements like dietary needs or accessibility are not optional extras: raise them explicitly and confirm they can be met.

## Customer
Name: ${b.contact.name}
Phone: ${b.contact.phone}
Email: ${b.contact.email}

Give these only when asked. Spell the surname if there is any doubt.

${
  paying
    ? `## Payment
The customer approved up to ${b.budget!.amount} ${b.budget!.currency}.

You do NOT have the card details. When they ask for payment:
1. Call \`get_payment_card\`.
2. If it returns awaiting approval, say you need a moment to confirm, wait, and call again. Never invent a card number.
3. Read the details once, then ask them to read the last four digits back.
4. Never repeat the full number afterwards, and never read it to voicemail or an IVR.

If the total exceeds the approved amount, call \`request_approval\` with the new figure rather than agreeing to it.`
    : `## No payment on this call
This is an enquiry only. You are NOT authorised to pay for anything, hold a card, or commit to a charge. If they ask for payment, say the customer will complete it themselves, and call \`record_failure\` noting payment was requested.`
}

## Finishing
Get a confirmation or reference number and repeat it back to check it, then call \`record_confirmation\`. If nothing was booked, call \`record_failure\` with a short reason. Never retry a payment — a second attempt risks a duplicate charge.

Be warm, concise and patient. Hold music and transfers are normal; wait them out.`;
}

/** Dynamic variables for ElevenLabs. Completes the full booking-agent key set. */
export function reservationVariables(
  b: ReservationBrief,
  sessionId: string,
): Record<string, string> {
  const given = b.contact.name.split(" ")[0] ?? b.contact.name;
  const family = b.contact.name.split(" ").slice(1).join(" ") || "";

  return completeDynamicVariables({
    session_id: sessionId,
    merchant_name: b.merchant_name,
    category: b.category,
    request: b.request,
    party_size: b.party_size ? String(b.party_size) : "not specified",
    when: b.when ?? "not specified",
    requirements: b.requirements.join("; ") || "none",
    given_name: given,
    family_name: family,
    phone_number: b.contact.phone,
    email: b.contact.email || "n/a",
    amount: b.budget?.amount ?? "0",
    currency: b.budget?.currency ?? "USD",

    // Flight-prompt aliases — booking agent dashboard often still has these.
    carrier: b.merchant_name,
    airline_phone: b.contact.phone,
    departing_at: b.when ?? "n/a",
    cabin: b.category,
    seat_preference: b.requirements.join("; ") || "no preference",
  });
}
