import { NextResponse } from "next/server";
import { handleLinqInbound } from "@/lib/collector/linq-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Linq Partner webhooks — subscribe with:
 * POST /api/partner/v3/webhook-subscriptions
 * target_url: https://<host>/api/channels/linq/webhook?version=2026-02-03
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Linq v3 (2026-02-03): event_type + nested data.chat / data.parts
  const eventType = String(
    body.event_type || body.type || body.event || "",
  ).toLowerCase();

  const data =
    (body.data as Record<string, unknown>) ||
    (body.payload as Record<string, unknown>) ||
    body;

  // Ignore our own outbound echoes
  const direction = String(data.direction || "").toLowerCase();
  const senderHandle = data.sender_handle as
    | { handle?: string; is_me?: boolean }
    | undefined;
  if (direction === "outbound" || senderHandle?.is_me === true) {
    return NextResponse.json({ ok: true, handled: false, skipped: "outbound" });
  }

  const chatId = String(
    data.chat_id ||
      data.chatId ||
      (data.chat as { id?: string })?.id ||
      body.chat_id ||
      "",
  );

  const parts = Array.isArray(data.parts)
    ? (data.parts as Array<{ type?: string; value?: string }>)
    : [];
  const text = String(
    data.text ||
      data.body ||
      parts
        .filter((p) => !p.type || p.type === "text")
        .map((p) => p.value)
        .filter(Boolean)
        .join(" ") ||
      (data.message as { text?: string })?.text ||
      "",
  ).trim();

  const from = String(
    data.from ||
      senderHandle?.handle ||
      data.sender ||
      data.phone ||
      (data.author as { phone?: string })?.phone ||
      "",
  );

  if (
    eventType.includes("received") ||
    (!eventType && text && chatId)
  ) {
    if (chatId && text) {
      const eventId = String(body.event_id || body.id || "");
      const result = await handleLinqInbound({
        chat_id: chatId,
        from_phone: from,
        text,
        event_id: eventId || undefined,
      });
      return NextResponse.json({ ok: true, handled: true, ...result });
    }
  }

  return NextResponse.json({
    ok: true,
    handled: false,
    eventType,
    hasChat: Boolean(chatId),
    hasText: Boolean(text),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    channel: "linq",
    tip: "POST webhook events here. Subscribe via POST /api/channels/linq/subscribe",
  });
}
