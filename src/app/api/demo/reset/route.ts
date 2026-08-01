import { NextResponse } from "next/server";
import { resetWhatsAppBook } from "@/lib/integrations/whatsapp-phonebook";
import { resetSocialStore } from "@/lib/social-store";
import { resetStore, seedDemoEvent } from "@/lib/store";

export async function POST() {
  resetStore();
  resetSocialStore();
  resetWhatsAppBook();
  const event = seedDemoEvent();
  return NextResponse.json({
    ok: true,
    event,
    tip: "WhatsApp sessions cleared. In the +1 (555) 158-1137 chat, reply PLAN to start fresh.",
  });
}
