import { NextResponse } from "next/server";
import {
  bookFlightWithVault,
  bookGroupFlightWithVault,
} from "@/lib/integrations/flights";
import { reserveDining } from "@/lib/integrations/dining";
import { getPaymentResult, reportPaymentStatus } from "@/lib/integrations/prava";
import { sendLinqChatMessage } from "@/lib/integrations/linq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * After Prava Collect succeeds: report status, then optionally issue
 * flight (Duffel/vault) or dining reservation when offer_id is provided.
 */
export async function POST(req: Request) {
  let body: {
    session_id?: string;
    merchant?: string;
    amount?: number;
    currency?: string;
    category?: string;
    linq_chat_id?: string;
    offer_id?: string;
    user_id?: string;
    /** One order N vault passports */
    user_ids?: string[];
    spoc_name?: string;
    party_size?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.session_id || !body.merchant || body.amount == null) {
    return NextResponse.json(
      { error: "session_id, merchant, amount required" },
      { status: 400 },
    );
  }

  let result = await getPaymentResult(body.session_id);
  for (let i = 0; i < 5 && result.status === "awaiting_result"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await getPaymentResult(body.session_id);
  }

  if (result.status !== "completed") {
    await reportPaymentStatus(body.session_id, "DECLINED");
    return NextResponse.json(
      { ok: false, error: `Payment not completed (status: ${result.status})` },
      { status: 402 },
    );
  }

  await reportPaymentStatus(body.session_id, "APPROVED");

  const category = (body.category || "trip").toLowerCase();
  let confirmation_id = `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  let bookingNote = "";
  let booking: unknown = null;

  const groupIds = Array.isArray(body.user_ids)
    ? body.user_ids.filter(Boolean)
    : [];
  if (
    body.offer_id &&
    (body.user_id || groupIds.length) &&
    (category === "flight" || category === "trip")
  ) {
    const booked =
      groupIds.length > 1
        ? await bookGroupFlightWithVault({
            offerId: body.offer_id,
            passengers: groupIds.map((userId) => ({ userId })),
          })
        : await bookFlightWithVault({
            offerId: body.offer_id,
            userId: body.user_id || groupIds[0]!,
          });
    if (booked.ok) {
      confirmation_id = booked.confirmation_id;
      bookingNote = ` Flight issued (${booked.mode})${groupIds.length > 1 ? ` · ${groupIds.length} pax one order` : ""}.`;
      booking = booked;
    } else {
      bookingNote = ` Payment ok — flight not issued yet: ${booked.failure_reason}`;
      booking = booked;
    }
  } else if (
    category === "dining" &&
    (body.offer_id || body.merchant) &&
    body.spoc_name
  ) {
    const reserved = await reserveDining({
      offerId: body.offer_id || `dining_${body.session_id}`,
      restaurant: body.merchant,
      spoc_name: body.spoc_name,
      party_size: body.party_size || 2,
    });
    if (reserved.ok) {
      confirmation_id = reserved.confirmation_id;
      bookingNote = ` ${reserved.notes}`;
      booking = reserved;
    } else {
      bookingNote = ` Payment ok — reservation pending: ${reserved.failure_reason}`;
      booking = reserved;
    }
  }

  const tokenRef = result.token ? `•••• ${result.token.slice(-4)}` : "mock";
  const summary =
    result.mode === "live"
      ? `Prava session ${body.session_id} → card ${tokenRef} for $${Number(body.amount).toFixed(2)} at ${body.merchant}. Confirmation ${confirmation_id}.${bookingNote}`
      : `Checkout ${confirmation_id} for $${Number(body.amount).toFixed(2)} at ${body.merchant}.${bookingNote}`;

  if (body.linq_chat_id) {
    await sendLinqChatMessage({
      chat_id: body.linq_chat_id,
      text: `Booked via Prava · ${confirmation_id}\n${body.merchant} · $${Number(body.amount).toFixed(2)}${bookingNote}`,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    confirmation_id,
    summary,
    booking,
    needs_passport: /passport/i.test(bookingNote),
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id,
        session_id: body.session_id,
        mandate_id: body.session_id,
        token_ref: tokenRef,
        merchant: body.merchant,
        amount: Number(body.amount),
        mode: result.mode,
        summary,
        booking,
      },
    },
  });
}
