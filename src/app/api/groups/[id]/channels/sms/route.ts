import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { getGroup, addMember, createInvite } from "@/lib/groups/store";
import { hasTwilioSms, sendSmsBatch, inviteMessage, toE164 } from "@/lib/integrations/twilio-sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite people to a group over SMS via Twilio.
 *
 * The WhatsApp path is unusable for real invites while Meta is on a test
 * number — it rejects any recipient not pre-verified in the dashboard
 * (error 131030). Twilio has no such allowlist on a full account.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await resolveGroupUser(req);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const group = await getGroup(id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  if (!hasTwilioSms()) {
    return NextResponse.json(
      { error: "SMS not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER)" },
      { status: 503 },
    );
  }

  let body: { phones?: string[]; names?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.phones || []).map((p) => String(p).trim()).filter(Boolean);
  if (!raw.length) return NextResponse.json({ error: "phones required" }, { status: 400 });

  // Normalise first so an unparseable number is reported rather than silently
  // handed to Twilio to fail on.
  const parsed = raw.map((p) => ({ raw: p, e164: toE164(p) }));
  const invalid = parsed.filter((p) => !p.e164).map((p) => p.raw);
  const valid = parsed.filter((p) => p.e164) as Array<{ raw: string; e164: string }>;

  if (!valid.length) {
    return NextResponse.json(
      { error: "No valid phone numbers", invalid },
      { status: 400 },
    );
  }

  const invite = await createInvite(id, user.id);
  const inviteUrl = `${new URL(req.url).origin}/invite/${invite.token}`;
  const text = inviteMessage({
    groupTitle: group.title,
    inviterName: user.name,
    inviteUrl,
  });

  const out = await sendSmsBatch(valid.map((v) => ({ phone: v.e164, body: text })));

  // Only add members whose invite actually went out, so the roster doesn't fill
  // with people who were never contacted.
  for (let i = 0; i < valid.length; i++) {
    if (!out.results[i]?.ok) continue;
    const v = valid[i]!;
    await addMember({
      groupId: id,
      userId: `sms_${v.e164.replace(/\D/g, "")}`,
      displayName: body.names?.[i] || v.e164,
      phone: v.e164,
      channel: "system",
    });
  }

  return NextResponse.json({
    ok: out.sent > 0,
    sent: out.sent,
    failed: out.failed,
    invalid,
    invite_url: inviteUrl,
    results: out.results.map((r) => ({ to: r.to, ok: r.ok, error: r.error })),
  });
}
