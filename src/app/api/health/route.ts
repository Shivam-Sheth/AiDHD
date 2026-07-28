import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/integrations/config";
import { listWhatsAppWebhookHits } from "@/lib/integrations/whatsapp-webhook-debug";

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: "AiDHD",
    hackathon: "Prava Agentic Commerce Hackathon 2026",
    integrations: integrationStatus(),
    whatsapp_webhook_recent: listWhatsAppWebhookHits(),
  });
}
