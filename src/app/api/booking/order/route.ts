import { NextResponse } from "next/server";
import { createOrder, type Consent, type Passenger } from "@/lib/booking/order";
import { loadPassportPlaintext } from "@/lib/vault/traveler-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates the order. This is the call that spends money, so it requires an
 * explicit consent object and an idempotency key from the caller.
 *
 * Passport numbers are never accepted over the wire — the client sends a
 * user_id and the plaintext is pulled from the encrypted vault server-side, so
 * it stays out of request logs and browser state.
 */
export async function POST(req: Request) {
  let body: {
    offer_id?: string;
    idempotency_key?: string;
    consent?: Consent;
    passengers?: Array<Omit<Passenger, "passport_number"> & { user_id: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { offer_id, idempotency_key, consent, passengers } = body;
  if (!offer_id || !idempotency_key || !consent || !passengers?.length) {
    return NextResponse.json(
      { error: "offer_id, idempotency_key, consent and passengers are required" },
      { status: 400 },
    );
  }
  if (!consent.accepted_conditions) {
    return NextResponse.json(
      { error: "Terms must be explicitly accepted before booking." },
      { status: 400 },
    );
  }

  const resolved: Passenger[] = [];
  for (const p of passengers) {
    const passport = await loadPassportPlaintext(p.user_id);
    if (!passport) {
      return NextResponse.json(
        { error: `No passport on file for ${p.given_name} ${p.family_name}.`, stage: "passport" },
        { status: 409 },
      );
    }
    const { user_id: _user_id, ...rest } = p;
    void _user_id;
    resolved.push({ ...rest, passport_number: passport });
  }

  const result = await createOrder({
    offer_id,
    passengers: resolved,
    consent,
    idempotency_key,
    // Card path stays off until Duffel Payments is entitled; preparePayment
    // falls back to balance, which is what makes sandbox runnable today.
    card: null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, stage: result.stage, retryable: result.retryable },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
