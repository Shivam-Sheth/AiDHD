import { NextResponse } from "next/server";
import { inviteWhatsAppPhones } from "@/lib/collector/whatsapp-bot";
import { hasWhatsApp } from "@/lib/integrations/config";

/**
 * Start the task-scoped WhatsApp collector for one or more numbers.
 * Numbers must already be Meta test recipients (sandbox).
 *
 * POST { "phones": ["+15551234567", ...], "names": ["Alex", ...] }
 */
export async function POST(req: Request) {
  if (!hasWhatsApp()) {
    return NextResponse.json(
      {
        error:
          "WhatsApp not live — set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID",
      },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    phones?: string[];
    names?: string[];
    event_id?: string;
  };

  const phones = (body.phones ?? []).map((p) => String(p).trim()).filter(Boolean);
  if (!phones.length) {
    return NextResponse.json(
      { error: "phones array required, e.g. [\"+15551234567\"]" },
      { status: 400 },
    );
  }

  try {
    const result = await inviteWhatsAppPhones({
      event_id: body.event_id,
      phones: phones.map((phone, i) => ({
        phone,
        name: body.names?.[i],
      })),
    });
    return NextResponse.json({
      ok: true,
      mode: "live",
      ...result,
      tip:
        result.tip ||
        "Check WhatsApp for +1 (555) 158-1137. hello_world is Meta’s sandbox opener; AiDHD’s planning message follows.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invite failed" },
      { status: 500 },
    );
  }
}
