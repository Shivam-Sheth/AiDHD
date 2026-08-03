import { NextResponse } from "next/server";
import { createCallSession, updateCallSession, noteOnSession } from "@/lib/booking/call-session";
import {
  reservationFirstMessage,
  reservationPrompt,
  reservationVariables,
  type ReservationBrief,
} from "@/lib/booking/reservation-script";
import { lookupMerchant, normalisePhone, type MerchantCategory } from "@/lib/booking/merchant-lookup";
import { placeElevenAgentsOutbound } from "@/lib/integrations/voice";
import { createPravaSession } from "@/lib/integrations/prava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generalised booking call — restaurants, hotels, venues, stores, support.
 *
 * The flight path (/orchestrate) needs a Duffel offer. This one needs only a
 * merchant name: it looks the place up, dials, and states the request. A
 * payment mandate is created only when `budget` is supplied, so availability
 * enquiries never mint a card.
 */

const CATEGORIES: MerchantCategory[] = [
  "restaurant", "hotel", "airline", "event_venue",
  "ticket_provider", "store", "customer_support", "other",
];

export async function POST(req: Request) {
  let body: {
    merchant?: string;
    near?: string;
    phone?: string;
    category?: MerchantCategory;
    request?: string;
    party_size?: number;
    when?: string;
    requirements?: string[];
    budget?: { amount: string; currency: string } | null;
    contact?: { name: string; phone: string; email: string };
    user_id?: string;
    dry_run?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { merchant, request: ask, contact } = body;
  if (!merchant || !ask || !contact?.name || !contact?.phone) {
    return NextResponse.json(
      { error: "merchant, request and contact{name,phone} are required" },
      { status: 400 },
    );
  }

  const category: MerchantCategory = CATEGORIES.includes(body.category as MerchantCategory)
    ? (body.category as MerchantCategory)
    : "other";

  // A caller-supplied number always wins; otherwise try Places.
  let phone = normalisePhone(body.phone);
  let lookup = null;
  if (!phone) {
    lookup = await lookupMerchant({ query: merchant, near: body.near ?? null });
    phone = lookup?.phone ?? null;
  }

  if (!phone) {
    return NextResponse.json(
      {
        error: "No phone number for that merchant.",
        stage: "lookup",
        merchant: lookup?.name ?? merchant,
        address: lookup?.address ?? null,
        reason:
          lookup?.phone_unavailable_reason ??
          "Merchant not found. Pass `phone` explicitly.",
        hint: "Ask the user for the number, or enable Places contact data in Google Cloud.",
      },
      { status: 422 },
    );
  }

  const brief: ReservationBrief = {
    category,
    merchant_name: lookup?.name ?? merchant,
    request: ask,
    party_size: typeof body.party_size === "number" ? body.party_size : null,
    when: body.when ?? null,
    requirements: (body.requirements ?? []).filter(Boolean),
    budget: body.budget ?? null,
    contact: { name: contact.name, phone: contact.phone, email: contact.email ?? "" },
  };

  // Mandate only when money is actually in play.
  const prava = brief.budget
    ? await createPravaSession({
        user_id: body.user_id || contact.email || contact.phone,
        user_email: contact.email || "",
        merchant: brief.merchant_name,
        amount: Number(brief.budget.amount),
        currency: brief.budget.currency,
        category: category === "restaurant" ? "dining" : category,
        merchant_url: "https://ai-dhd.vercel.app",
      })
    : null;

  const session = createCallSession({
    flight: {
      carrier: brief.merchant_name,
      flight_number: "",
      origin: "",
      destination: "",
      departing_at: brief.when ?? "",
      amount: brief.budget?.amount ?? "0",
      currency: brief.budget?.currency ?? "USD",
    },
    passenger: {
      given_name: brief.contact.name.split(" ")[0] ?? brief.contact.name,
      family_name: brief.contact.name.split(" ").slice(1).join(" ") || "",
      born_on: "",
      email: brief.contact.email,
      phone_number: brief.contact.phone,
    },
    airline_phone: phone,
    prava_session_id: prava?.session_id ?? null,
    extras: {
      cabin: category,
      checked_bags: 0,
      seat_preference: brief.requirements.join("; ") || null,
      estimated_extras_cost: "0.00",
    },
  });

  if (body.dry_run) {
    noteOnSession(session.id, "dry run — no call placed");
    return NextResponse.json({
      ok: true,
      dry_run: true,
      session_id: session.id,
      merchant: { name: brief.merchant_name, phone, address: lookup?.address ?? null },
      would_say: reservationFirstMessage(brief),
      system_prompt: reservationPrompt(brief),
      mandate: prava
        ? { prava_session_id: prava.session_id, approve_url: prava.iframe_url }
        : null,
    });
  }

  const placed = await placeElevenAgentsOutbound({
    to: phone,
    first_message: reservationFirstMessage(brief),
    agent_id: process.env.ELEVENLABS_BOOKING_AGENT_ID,
    dynamic_variables: reservationVariables(brief, session.id),
  });

  if (!placed.ok) {
    updateCallSession(session.id, { stage: "failed", failure_reason: placed.detail });
    return NextResponse.json(
      { error: placed.detail, stage: "dial", session_id: session.id },
      { status: 503 },
    );
  }

  updateCallSession(session.id, {
    stage: "dialing",
    conversation_id: placed.conversation_id ?? null,
  });
  noteOnSession(session.id, `dialing ${brief.merchant_name} at ${phone}`);

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    conversation_id: placed.conversation_id,
    stage: "dialing",
    merchant: { name: brief.merchant_name, phone, address: lookup?.address ?? null },
    mandate: prava
      ? {
          prava_session_id: prava.session_id,
          approve_url: prava.iframe_url,
          amount: brief.budget?.amount,
          currency: brief.budget?.currency,
        }
      : null,
    note: prava ? undefined : "Enquiry only — no payment mandate created.",
  });
}
