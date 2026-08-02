import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { appendMessage, getGroup, isMember } from "@/lib/groups/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_TYPES = new Set([
  "product",
  "booking",
  "reservation",
  "cart",
  "payment",
  "flight",
  "hotel",
  "event",
  "link",
]);

/**
 * Share a product / booking / reservation / cart / payment / link into
 * the group chat as a structured "share" message.
 *
 * POST { type, title, url?, price?, currency?, image_url?, note?, data? }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }
  if (!(await isMember(id, user.id))) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: {
    type?: string;
    title?: string;
    url?: string;
    price?: number;
    currency?: string;
    image_url?: string;
    note?: string;
    data?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = (body.type || "link").toLowerCase();
  if (!SHARE_TYPES.has(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...SHARE_TYPES].join(", ")}` },
      { status: 400 },
    );
  }
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const priceLine =
    body.price != null ? ` — $${Number(body.price).toFixed(2)}` : "";
  const message = await appendMessage({
    groupId: id,
    senderId: user.id,
    senderName: user.name,
    body: `Shared a ${type}: ${title}${priceLine}${body.note ? `\n${body.note}` : ""}${body.url ? `\n${body.url}` : ""}`,
    kind: "share",
    meta: {
      share_type: type,
      title,
      url: body.url,
      price: body.price,
      currency: body.currency || "USD",
      image_url: body.image_url,
      data: body.data || {},
    },
  });

  return NextResponse.json({
    ok: true,
    message: message ? { ...message, body_ciphertext: undefined } : null,
  });
}
