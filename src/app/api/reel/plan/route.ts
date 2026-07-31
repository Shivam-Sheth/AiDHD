import { NextResponse } from "next/server";
import { planFromReel } from "@/lib/reel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Frontend / app entry for “share a reel → plan”.
 * Body: { url?, transcript?, party_size?, selected_date?, selected_time?, budget_cap?, origin_city? }
 */
export async function POST(req: Request) {
  let body: {
    url?: string;
    transcript?: string;
    caption?: string;
    cached_caption?: string;
    party_size?: number;
    selected_date?: string;
    date_range?: string;
    selected_time?: string;
    budget_cap?: number;
    origin_city?: string;
    relaxed?: boolean;
    stage?: "preview" | "finalize" | "auto";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url?.trim()) {
    return NextResponse.json(
      { error: "Provide a public Instagram or TikTok reel url" },
      { status: 400 },
    );
  }

  try {
    const result = await planFromReel({
      url: body.url,
      transcript: body.transcript,
      caption: body.caption,
      cached_caption: body.cached_caption,
      party_size: body.party_size,
      selected_date: body.selected_date,
      date_range: body.date_range,
      selected_time: body.selected_time,
      budget_cap: body.budget_cap,
      origin_city: body.origin_city,
      relaxed: body.relaxed ?? false,
      stage: body.stage,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Reel plan failed",
      },
      { status: 500 },
    );
  }
}
