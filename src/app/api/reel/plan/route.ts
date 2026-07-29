import { NextResponse } from "next/server";
import { planFromReel } from "@/lib/reel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Frontend / app entry for “share a reel → plan”.
 * Body: { url?, transcript?, party_size?, selected_date?, selected_time?, budget_cap?, origin_city? }
 */
export async function POST(req: Request) {
  let body: {
    url?: string;
    transcript?: string;
    party_size?: number;
    selected_date?: string;
    selected_time?: string;
    budget_cap?: number;
    origin_city?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url && !body.transcript?.trim()) {
    return NextResponse.json(
      { error: "Provide url or transcript" },
      { status: 400 },
    );
  }

  try {
    const result = await planFromReel({
      url: body.url,
      transcript: body.transcript,
      party_size: body.party_size,
      selected_date: body.selected_date,
      selected_time: body.selected_time,
      budget_cap: body.budget_cap,
      origin_city: body.origin_city,
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
