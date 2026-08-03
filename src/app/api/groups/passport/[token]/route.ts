import { NextResponse } from "next/server";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
} from "@/lib/groups/types";
import {
  appendMessage,
  getBookingDraftByCollectToken,
  getGroup,
  updateBookingDraft,
} from "@/lib/groups/store";
import {
  getPassportRef,
  savePassport,
} from "@/lib/vault/traveler-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const hit = await getBookingDraftByCollectToken(token);
  if (!hit) {
    return NextResponse.json({ error: "Link expired or invalid." }, { status: 404 });
  }
  const { draft, traveler } = hit;
  const group = await getGroup(draft.group_id);
  const ref = await getPassportRef(traveler.user_id);

  return NextResponse.json({
    group: group
      ? { id: group.id, title: group.title }
      : { id: draft.group_id, title: "Trip" },
    draft_id: draft.id,
    traveler: {
      user_id: traveler.user_id,
      display_name: traveler.display_name,
      passport_present: Boolean(ref?.present),
      collect_token: traveler.collect_token,
    },
    summary: String(draft.offer.summary || ""),
    party_size: draft.party_size,
  });
}

/** Save passport for this traveler only — never echoes the number back to chat. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const hit = await getBookingDraftByCollectToken(token);
  if (!hit) {
    return NextResponse.json({ error: "Link expired or invalid." }, { status: 404 });
  }
  const { draft, traveler } = hit;

  let body: {
    passport_number?: string;
    remember?: boolean;
    email?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const passport_number = body.passport_number?.trim();
  if (!passport_number || passport_number.length < 5) {
    return NextResponse.json(
      { error: "Enter a valid passport number." },
      { status: 400 },
    );
  }

  const saved = await savePassport({
    user_id: traveler.user_id,
    passport_number,
    display_name: traveler.display_name,
    email: body.email,
    remember: body.remember !== false,
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 503 });
  }

  // Refresh presence flags on the draft (status only — no numbers)
  for (const t of draft.travelers) {
    const ref = await getPassportRef(t.user_id);
    t.passport_present = Boolean(ref?.present);
  }
  await updateBookingDraft(draft);

  const stillMissing = draft.travelers.filter(
    (t) => t.needs_passport && !t.passport_present,
  );

  let chatBody = `${traveler.display_name} added passport ✓ (private — number not shown here).`;
  if (stillMissing.length) {
    chatBody += `\nStill waiting: ${stillMissing.map((m) => m.display_name).join(", ")}.`;
  } else {
    chatBody += `\nEveryone's ready — one order for ${draft.party_size}. Host can approve & pay; tickets issue from vaults.`;
  }

  await appendMessage({
    groupId: draft.group_id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: chatBody,
    kind: "booking_prompt",
    meta: {
      draft_id: draft.id,
      passport_status: stillMissing.length ? "partial" : "complete",
      ready_user_id: traveler.user_id,
    },
  });

  return NextResponse.json({
    ok: true,
    remembered: saved.remembered !== false,
    passport_present: true,
    all_ready: stillMissing.length === 0,
    still_missing: stillMissing.map((m) => m.display_name),
  });
}
