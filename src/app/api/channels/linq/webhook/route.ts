import { NextResponse } from "next/server";
import { handleLinqInbound } from "@/lib/collector/linq-bot";
import {
  handleLinqGroupInbound,
  looksLikeGroupThread,
} from "@/lib/collector/linq-group";
import { claimLinqEvent } from "@/lib/collector/linq-sessions";
import { mentionsAidhd } from "@/lib/groups/mentions";
import { sendLinqChatMessage } from "@/lib/integrations/linq";

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

      // A thread linked to a group party is a group iMessage chat — route it to
      // the full group agent (chat history + tools + approvals) instead of the
      // 1:1 collector. Claim the event here so the group path is retry-safe too.
      if (eventId) {
        const fresh = await claimLinqEvent(eventId);
        if (!fresh) {
          return NextResponse.json({
            ok: true,
            handled: false,
            skipped: "duplicate_event",
          });
        }
      }

      // Surfaced so you can grab the id and link the thread to a group with
      // POST /api/groups/:id/channels/linq {"chat_id": "..."}.
      console.log("[linq] inbound chat_id=%s from=%s", chatId, from);

      const grouped = await handleLinqGroupInbound({
        chat_id: chatId,
        from_phone: from,
        text,
        origin: new URL(req.url).origin,
      });
      if (grouped.handled) {
        return NextResponse.json({
          ok: true,
          handled: true,
          route: "group",
          group_id: grouped.group_id,
          replies: grouped.replies,
        });
      }

      // Unlinked thread. The 1:1 collector answers every message it sees, which
      // would carpet a real group chat, so a group stays silent until tagged.
      if (looksLikeGroupThread({ chatId, fromPhone: from, data })) {
        if (!mentionsAidhd(text)) {
          return NextResponse.json({
            ok: true,
            handled: false,
            skipped: "untagged_unlinked_group",
            chat_id: chatId,
          });
        }
        await sendLinqChatMessage({
          chat_id: chatId,
          text: "hey — I'm here, but this thread isn't linked to a party yet. Open AiDHD → your group → Invite friends → iMessage to connect it, then tag me again.",
        });
        return NextResponse.json({
          ok: true,
          handled: true,
          route: "unlinked_group",
          chat_id: chatId,
        });
      }

      // event_id is deliberately omitted: it was already claimed above, and
      // re-claiming inside the collector would drop the message as a duplicate.
      const result = await handleLinqInbound({
        chat_id: chatId,
        from_phone: from,
        text,
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
