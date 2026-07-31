import { NextResponse } from "next/server";
import { readUi } from "@/lib/agent-tools/ui-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll for UI cards published by agent tools (voice webhooks or text). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  const conversation_id = url.searchParams.get("conversation_id");
  const since = Number(url.searchParams.get("since") || "0");
  const items = readUi({ session, conversation_id, since });
  return NextResponse.json({
    ok: true,
    items,
    server_time: Date.now(),
  });
}
