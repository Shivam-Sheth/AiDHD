import { NextResponse } from "next/server";
import { fetchReelCaption } from "@/lib/reel/fetch-meta";
import { extractShoppingList } from "@/lib/reel/shopping-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reel -> shopping list.
 *
 * Accepts either a reel URL (caption is fetched) or pasted text, so it still
 * works when Instagram blocks the scrape — which it often does.
 *
 * Returns items only. Resolving them to real products and carts is a commerce
 * provider's job, deliberately not this route's.
 */
export async function POST(req: Request) {
  let body: { url?: string; text?: string; visual_text?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim();
  let caption = body.text?.trim() || "";
  let title = body.title?.trim() || "";

  if (!caption && url) {
    const meta = await fetchReelCaption(url).catch(() => null);
    caption = meta?.caption || "";
    title = title || meta?.title || "";
    if (!caption) {
      return NextResponse.json(
        {
          error:
            "Could not read that reel's caption. Paste the caption or description as `text` instead.",
          source_url: url,
        },
        { status: 422 },
      );
    }
  }

  if (!caption) {
    return NextResponse.json({ error: "Provide `url` or `text`" }, { status: 400 });
  }

  const list = await extractShoppingList({
    caption,
    visual_text: body.visual_text ?? null,
    title: title || null,
    source_url: url ?? null,
  });

  return NextResponse.json({
    ok: list.items.length > 0,
    list,
    note:
      list.items.length === 0
        ? "No purchasable items found in that caption."
        : undefined,
  });
}
