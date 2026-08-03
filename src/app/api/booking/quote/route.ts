import { NextResponse } from "next/server";
import { quoteOffer } from "@/lib/booking/quote";
import { cardRailStatus } from "@/lib/booking/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-price an offer and return the real fare conditions for the consent screen,
 * plus whether the card rail is currently open.
 */
export async function POST(req: Request) {
  let body: { offer_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const offerId = body.offer_id?.trim();
  if (!offerId) {
    return NextResponse.json({ error: "offer_id required" }, { status: 400 });
  }

  const [priced, rail] = await Promise.all([quoteOffer(offerId), cardRailStatus()]);

  if (!priced.ok) {
    return NextResponse.json(
      { error: priced.error, expired: priced.expired },
      { status: priced.expired ? 410 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    quote: priced.quote,
    payment_rail: rail,
  });
}
