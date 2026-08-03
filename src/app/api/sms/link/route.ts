import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  getSmsLinkByUser,
  startSmsLink,
  unlinkSms,
} from "@/lib/sms/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current SMS link status for the signed-in user. */
export async function GET(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const link = await getSmsLinkByUser(user.id);
  return NextResponse.json({
    linked: Boolean(link?.verified),
    pending: Boolean(link && !link.verified),
    phone_last4: link ? link.phone.slice(-4) : null,
    linq_number: process.env.LINQ_PHONE_NUMBER || null,
  });
}

/**
 * Start linking a phone: POST { phone } → user texts "LINK <code>" to the
 * Prava Linq number to verify ownership of the phone.
 */
export async function POST(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phone = body.phone?.trim();
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "A valid phone number is required." },
      { status: 400 },
    );
  }

  const { code, phone: normalized } = await startSmsLink({
    phone,
    userId: user.id,
    userName: user.name,
  });

  return NextResponse.json({
    ok: true,
    phone_last4: normalized.slice(-4),
    code,
    linq_number: process.env.LINQ_PHONE_NUMBER || null,
    instructions: `Text "LINK ${code}" to ${
      process.env.LINQ_PHONE_NUMBER || "the Prava number"
    } from that phone to finish linking.`,
  });
}

export async function DELETE(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await unlinkSms(user.id);
  return NextResponse.json({ ok: true });
}
