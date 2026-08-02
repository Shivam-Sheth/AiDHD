import { NextResponse } from "next/server";
import { subscribeLinqWebhook } from "@/lib/integrations/linq";
import { hasLinq } from "@/lib/integrations/config";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Register Linq webhook → this deploy's /api/channels/linq/webhook */
export async function POST(req: Request) {
  if (!hasLinq()) {
    return NextResponse.json(
      { error: "LINQ_API_KEY required" },
      { status: 503 },
    );
  }

  let base = getBaseUrl();
  try {
    const body = (await req.json()) as { base_url?: string };
    if (body.base_url) base = body.base_url.replace(/\/$/, "");
  } catch {
    /* default */
  }

  const target_url = `${base}/api/channels/linq/webhook?version=2026-02-03`;
  const result = await subscribeLinqWebhook({ target_url });
  return NextResponse.json({
    ok: result.ok,
    target_url,
    result,
    reminder:
      "Sandbox is inbound-first: text your Linq number from iMessage before expecting replies. First outbound has no links.",
  });
}
