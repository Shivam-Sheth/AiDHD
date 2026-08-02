import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  addMember,
  createInvite,
  getGroup,
  isMember,
} from "@/lib/groups/store";
import { inviteWhatsAppPhones } from "@/lib/collector/whatsapp-bot";
import { hasWhatsApp } from "@/lib/integrations/config";
import { getEvent, upsertEvent } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite phone numbers via WhatsApp (Meta template first-touch).
 * Also adds them as group members and mirrors a collector Event.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const group = await getGroup(id);
  if (!group || !(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasWhatsApp()) {
    return NextResponse.json(
      { error: "WhatsApp keys not configured" },
      { status: 400 },
    );
  }

  let body: { phones?: string[]; names?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phones = (body.phones ?? [])
    .map((p) => String(p).trim())
    .filter(Boolean);
  if (!phones.length) {
    return NextResponse.json({ error: "phones required" }, { status: 400 });
  }

  // Ensure WhatsApp collector Event exists for this party
  const eventId = group.legacy_event_id || group.id;
  if (!getEvent(eventId)) {
    upsertEvent({
      id: eventId,
      type: group.mode,
      title: group.title,
      destination_or_venue: group.place,
      proposed_dates: group.proposed_dates,
      organizer_id: group.organizer_id,
      invitee_ids: [group.organizer_id],
      status: "collecting",
      created_via: "whatsapp",
      created_at: group.created_at,
    });
  }

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i]!;
    await addMember({
      groupId: id,
      userId: `wa_${phone.replace(/\D/g, "")}`,
      displayName: body.names?.[i] || phone,
      phone,
      channel: "whatsapp",
    });
  }

  const invite = await createInvite(id, user.id);
  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/invite/${invite.token}`;

  const result = await inviteWhatsAppPhones({
    event_id: eventId,
    phones: phones.map((phone, i) => ({
      phone,
      name: body.names?.[i],
    })),
  });

  return NextResponse.json({
    ok: true,
    group_id: id,
    invite_url: inviteUrl,
    ...result,
    event_id: eventId,
    tip:
      (result.tip || "") +
      ` Also share the web invite if the template is still in the 24h window: ${inviteUrl}`,
  });
}
