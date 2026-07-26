import { NextResponse } from "next/server";
import { scriptedWhatsAppFlow } from "@/lib/integrations/whatsapp";
import { ensureSeeded, getEvent, listEvents } from "@/lib/store";

export async function GET() {
  ensureSeeded();
  const event = listEvents()[0] ?? getEvent("evt_demo_friday");
  return NextResponse.json({
    channel: "whatsapp",
    mode: process.env.META_WHATSAPP_TOKEN ? "live" : "mock",
    compliance_note:
      "Task-scoped collector only (budget/prefs for named event) — not an open-domain chatbot.",
    transcript: scriptedWhatsAppFlow(event?.title ?? "Friday night out"),
  });
}
