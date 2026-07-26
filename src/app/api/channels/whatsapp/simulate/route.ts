import { NextResponse } from "next/server";
import { handleWhatsAppInbound } from "@/lib/collector/whatsapp-bot";
import { hasWhatsApp } from "@/lib/integrations/config";
import { normalizePhone } from "@/lib/integrations/whatsapp-phonebook";

/**
 * Local-only stand-in when Meta webhooks aren't reaching the tunnel.
 * Treats a typed message as an inbound WhatsApp reply and sends the bot response.
 */
export async function POST(req: Request) {
  if (!hasWhatsApp()) {
    return NextResponse.json({ error: "WhatsApp not live" }, { status: 400 });
  }

  const body = (await req.json()) as {
    phone?: string;
    message?: string;
    name?: string;
  };
  const phone = normalizePhone(body.phone || "");
  const message = (body.message || "").trim();
  if (!phone || !message) {
    return NextResponse.json(
      { error: "phone and message required" },
      { status: 400 },
    );
  }

  try {
    const result = await handleWhatsAppInbound({
      from: phone,
      text: message,
      profileName: body.name,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Simulate failed" },
      { status: 500 },
    );
  }
}
