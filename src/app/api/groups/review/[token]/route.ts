import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
} from "@/lib/groups/types";
import {
  appendMessage,
  getBookingDraftByToken,
  getGroup,
  listMembers,
  updateBookingDraft,
} from "@/lib/groups/store";
import { bookGroupFlightWithVault } from "@/lib/integrations/flights";
import { reserveDining } from "@/lib/integrations/dining";
import { createPravaSession } from "@/lib/integrations/prava";
import { getPassportRef } from "@/lib/vault/traveler-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFrom(req: Request) {
  const u = new URL(req.url);
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || u.origin;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const draft = await getBookingDraftByToken(token);
  if (!draft) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const group = await getGroup(draft.group_id);
  const members = group ? await listMembers(group.id) : [];
  const origin = originFrom(req);

  const travelers = [];
  for (const t of draft.travelers) {
    const ref = await getPassportRef(t.user_id);
    const present = Boolean(ref?.present);
    t.passport_present = present;
    travelers.push({
      ...t,
      passport_present: present,
      collect_url:
        t.needs_passport && t.collect_token
          ? `${origin}/groups/${draft.group_id}/passport/${t.collect_token}`
          : null,
    });
  }

  return NextResponse.json({
    draft: { ...draft, travelers },
    group: group
      ? {
          id: group.id,
          title: group.title,
          mode: group.mode,
          place: group.place,
          spoc_user_id: group.spoc_user_id,
        }
      : null,
    members: members
      .filter((m) => m.role !== "bot")
      .map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        role: m.role,
      })),
  });
}

/** Approve itinerary → Prava, or book after payment (one order N vault passports). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { token } = await ctx.params;
  const draft = await getBookingDraftByToken(token);
  if (!draft) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const group = await getGroup(draft.group_id);
  if (!group) {
    return NextResponse.json({ error: "Group gone." }, { status: 404 });
  }

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action || "approve";
  const origin = originFrom(req);

  const needsPassport =
    draft.category === "flight" || draft.category === "trip";

  // Refresh passport presence
  for (const t of draft.travelers) {
    const ref = await getPassportRef(t.user_id);
    t.passport_present = Boolean(ref?.present);
  }

  if (needsPassport) {
    const missing = draft.travelers.filter(
      (t) => t.needs_passport && !t.passport_present,
    );
    if (missing.length) {
      const links = missing.map((m) => ({
        display_name: m.display_name,
        collect_url: m.collect_token
          ? `${origin}/groups/${group.id}/passport/${m.collect_token}`
          : null,
      }));
      return NextResponse.json(
        {
          error: `Passport still needed for: ${missing.map((m) => m.display_name).join(", ")}. Each person uses their private link — numbers never go in chat.`,
          missing,
          links,
        },
        { status: 400 },
      );
    }
  }

  if (
    (draft.category === "dining" || draft.category === "ticket") &&
    !group.spoc_user_id
  ) {
    return NextResponse.json(
      { error: "Need a SPOC volunteer in the group chat first." },
      { status: 400 },
    );
  }

  const members = await listMembers(group.id);
  const payer =
    members.find((m) => m.user_id === group.spoc_user_id) ||
    members.find((m) => m.user_id === group.organizer_id) ||
    members.find((m) => m.user_id === user.id);

  // Dining: name + headcount is enough — reserve under SPOC, optional deposit via Prava
  if (draft.category === "dining") {
    const spoc =
      members.find((m) => m.user_id === group.spoc_user_id) ||
      members.find((m) => m.user_id === group.organizer_id);
    const reserved = await reserveDining({
      offerId: String(draft.offer.offer_id || draft.id),
      restaurant: String(draft.offer.merchant || group.title),
      spoc_name: spoc?.display_name || user.name,
      party_size: draft.party_size,
    });
    if (!reserved.ok) {
      return NextResponse.json(
        { error: reserved.failure_reason },
        { status: 400 },
      );
    }
    draft.status = "booked";
    draft.offer = { ...draft.offer, confirmation_id: reserved.confirmation_id };
    await updateBookingDraft(draft);
    await appendMessage({
      groupId: group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: reserved.notes,
      kind: "booking_prompt",
      meta: { draft_id: draft.id, confirmation_id: reserved.confirmation_id },
    });
    return NextResponse.json({
      ok: true,
      draft,
      reservation: reserved,
    });
  }

  // Issue one flight order with N vault passports (after Prava / host confirms book)
  if (
    action === "book" &&
    needsPassport &&
    (draft.status === "awaiting_payment" || draft.status === "awaiting_review")
  ) {
    const offerId = String(draft.offer.offer_id || "");
    if (!offerId) {
      return NextResponse.json(
        {
          error:
            "No offer_id on this draft yet. Search flights with passengers=party size, then set offer_id on the draft / re-run book with a chosen offer.",
        },
        { status: 400 },
      );
    }
    const booked = await bookGroupFlightWithVault({
      offerId,
      passengers: draft.travelers.map((t) => ({ userId: t.user_id })),
    });
    if (!booked.ok) {
      return NextResponse.json(
        { error: booked.failure_reason, booking: booked },
        { status: 400 },
      );
    }
    draft.status = "booked";
    draft.offer = {
      ...draft.offer,
      confirmation_id: booked.confirmation_id,
      booking_reference: booked.booking_reference,
      order_id: booked.order_id,
    };
    await updateBookingDraft(draft);
    await appendMessage({
      groupId: group.id,
      senderId: AIDHD_BOT_ID,
      senderName: AIDHD_BOT_NAME,
      body: `Tickets issued — one order for ${draft.party_size}. Ref ${booked.confirmation_id}. Passports stayed in vaults (never in this chat).`,
      kind: "booking_prompt",
      meta: {
        draft_id: draft.id,
        confirmation_id: booked.confirmation_id,
        mode: booked.mode,
      },
    });
    return NextResponse.json({ ok: true, draft, booking: booked });
  }

  const amount = Number(draft.offer.amount ?? 0) || 50;
  const session = await createPravaSession({
    user_id: payer?.user_id || user.id,
    user_email: payer?.email || user.email || "payer@aidhd.app",
    merchant: String(draft.offer.merchant || group.title),
    amount,
    currency: "USD",
    category: draft.category === "trip" ? "flight" : draft.category,
  });

  draft.prava_session_id = session.session_id;
  draft.status = "awaiting_payment";
  draft.travelers = draft.travelers;
  await updateBookingDraft(draft);

  await appendMessage({
    groupId: group.id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: `${user.name} approved the ${draft.category} draft. Prava mandate ready for ${payer?.display_name || "payer"} ($${amount}). One order · ${draft.party_size} vault passports after Collect.`,
    kind: "booking_prompt",
    meta: {
      draft_id: draft.id,
      prava_session_id: session.session_id,
      iframe_url: session.iframe_url,
    },
  });

  return NextResponse.json({
    ok: true,
    draft,
    prava: {
      session_id: session.session_id,
      iframe_url: session.iframe_url,
      mode: session.mode,
      error: session.error,
    },
  });
}
