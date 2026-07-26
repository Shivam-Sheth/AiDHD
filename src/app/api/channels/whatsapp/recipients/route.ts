import { NextResponse } from "next/server";
import {
  listWhatsAppContacts,
  registerWhatsAppContact,
  seedJordanPhoneIfConfigured,
} from "@/lib/integrations/whatsapp-phonebook";

export async function GET() {
  seedJordanPhoneIfConfigured();
  return NextResponse.json({
    contacts: listWhatsAppContacts(),
    verify_token_set: Boolean(
      process.env.META_WHATSAPP_VERIFY_TOKEN || "aidhd_verify",
    ),
    default_event:
      process.env.WHATSAPP_DEFAULT_EVENT_ID || "evt_demo_friday",
  });
}

/** Pre-register phone → name mapping before invite (optional). */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    phones?: { phone: string; name?: string }[];
  };
  const rows = body.phones ?? [];
  const contacts = rows.map((r) =>
    registerWhatsAppContact({ phone: r.phone, name: r.name }),
  );
  return NextResponse.json({ ok: true, contacts });
}
