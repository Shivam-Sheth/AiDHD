import { NextResponse } from "next/server";
import { createPravaSession } from "@/lib/integrations/prava";
import { hasPrava } from "@/lib/integrations/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Judge-facing sample: create real sandbox Collect sessions per category.
 * In Prava, the session + passkey approval *is* the mandate scope — there is
 * no separate /mandates REST resource. We surface session ids as mandate refs.
 */
export async function GET() {
  if (!hasPrava()) {
    return NextResponse.json({
      ok: false,
      mode: "mock",
      error: "PRAVA_SECRET_KEY missing",
      mandates: [],
    });
  }

  const samples = [
    {
      category: "flight",
      merchant: "AiDHD · American Airlines ORD→JFK",
      amount: 150,
    },
    {
      category: "hotel",
      merchant: "AiDHD · Downtown stay",
      amount: 420,
    },
    {
      category: "dining",
      merchant: "AiDHD · Dinner hold",
      amount: 95,
    },
  ] as const;

  const mandates = [];
  for (const s of samples) {
    const session = await createPravaSession({
      user_id: `sample_${s.category}`,
      user_email: "judge@aidhd.app",
      merchant: s.merchant,
      amount: s.amount,
      currency: "USD",
      category: s.category,
    });
    mandates.push({
      category: s.category,
      merchant: s.merchant,
      amount_cap: s.amount,
      currency: "USD",
      status: session.error ? "failed" : "requested",
      mode: session.mode,
      // Prava: session scoped approval = mandate
      mandate_id: session.session_id,
      session_id: session.session_id,
      session_token_present: Boolean(session.session_token),
      collect_url: session.iframe_url,
      error: session.error,
      duration_minutes: 120,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "live",
    note: "Each row is a real sandbox Collect session. Approve passkey in Collect to complete; report-status closes the loop.",
    mandates,
  });
}
