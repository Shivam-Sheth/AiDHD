/**
 * Find a merchant's phone number so the booking agent can call them.
 *
 * Google Places holds this, but contact fields (phone, website) sit behind a
 * separate billable SKU — "Contact Data" on the legacy API, Enterprise on
 * Places API (New). As of 2026-08-02 this project's key returns places fine but
 * omits phone entirely, even with FieldMask "*", so `phone` comes back null and
 * the caller must ask the user for the number.
 *
 * Enable "Places API (New)" with the Enterprise SKU (or legacy Contact Data) in
 * Google Cloud and this starts returning numbers with no code change.
 */

const PLACES = "https://places.googleapis.com/v1";

export type MerchantCategory =
  | "restaurant"
  | "hotel"
  | "airline"
  | "event_venue"
  | "ticket_provider"
  | "store"
  | "customer_support"
  | "other";

export type MerchantLookup = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  place_id: string | null;
  /** Why phone is null, so the UI can say something useful. */
  phone_unavailable_reason: string | null;
};

function key(): string {
  return process.env.GOOGLE_MAPS_API || "";
}

/** E.164 for Twilio/ElevenLabs. Assumes NANP when no country code is given. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const d = "+" + trimmed.slice(1).replace(/\D/g, "");
    return d.length >= 8 ? d : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

export async function lookupMerchant(input: {
  query: string;
  near?: string | null;
}): Promise<MerchantLookup | null> {
  if (!key()) return null;

  const textQuery = input.near ? `${input.query} ${input.near}` : input.query;

  const search = await fetch(`${PLACES}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
  }).catch(() => null);

  if (!search?.ok) return null;

  const sdata = (await search.json().catch(() => ({}))) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
    }>;
  };
  const hit = sdata.places?.[0];
  if (!hit?.id) return null;

  // Contact fields need a Details call, and only return on the paid SKU.
  const details = await fetch(`${PLACES}/places/${encodeURIComponent(hit.id)}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask":
        "displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri",
    },
  }).catch(() => null);

  const d = details?.ok
    ? ((await details.json().catch(() => ({}))) as {
        internationalPhoneNumber?: string;
        nationalPhoneNumber?: string;
        websiteUri?: string;
      })
    : {};

  const phone = normalisePhone(d.internationalPhoneNumber || d.nationalPhoneNumber);

  return {
    name: hit.displayName?.text || input.query,
    address: hit.formattedAddress || null,
    phone,
    website: d.websiteUri || null,
    place_id: hit.id,
    phone_unavailable_reason: phone
      ? null
      : "Google Places did not return a phone number. Contact data is a separate billable SKU — enable it in Google Cloud, or supply the number manually.",
  };
}
