import { NextResponse } from "next/server";
import { getPaymentResult, reportPaymentStatus } from "@/lib/integrations/prava";
import { sendLinqChatMessage } from "@/lib/integrations/linq";
import { logInfo } from "@/lib/checkout/debug-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called right after @prava-sdk/core's collectPAN() succeeds in the browser,
 * for any leg that ISN'T a Duffel-payable flight (see /api/checkout/execute
 * for that path — it owns the real Duffel charge, including the same
 * poll-for-completed step this route also does). This route only ever closes
 * out the Prava enrollment; no merchant payment API is wired up yet for
 * dining/tickets/hotels — see browser-harness.ts for the intended path once
 * one of those needs UI-driven checkout.
 */
export async function POST(req: Request) {
  let body: {
    session_id?: string;
    merchant?: string;
    amount?: number;
    currency?: string;
    category?: string;
    linq_chat_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  logInfo("prava complete", "incoming request", {
    session_id: body.session_id,
    merchant: body.merchant,
    amount: body.amount,
    category: body.category,
  });

  if (!body.session_id || !body.merchant || body.amount == null) {
    return NextResponse.json(
      { error: "session_id, merchant, amount required" },
      { status: 400 },
    );
  }

  const PENDING_STATUSES = new Set(["pending", "processing", "awaiting_result"]);
  let attempt = 1;
  let result = await getPaymentResult(body.session_id);
  logInfo("prava complete", `poll attempt ${attempt} status=${result.status}`);
  for (let i = 0; i < 5 && PENDING_STATUSES.has(result.status); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    attempt += 1;
    result = await getPaymentResult(body.session_id);
    logInfo("prava complete", `poll attempt ${attempt} status=${result.status}`);
  }

  if (result.status !== "completed") {
    await reportPaymentStatus(body.session_id, "DECLINED");
    return NextResponse.json(
      { ok: false, error: `Payment not completed (status: ${result.status})` },
      { status: 402 },
    );
  }

  await reportPaymentStatus(body.session_id, "APPROVED");

  const confirmation_id = `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  const tokenRef = result.token ? `•••• ${result.token.slice(-4)}` : "mock";
  const summary =
    result.mode === "live"
      ? `Prava session ${body.session_id} → one-time card ${tokenRef} for $${Number(body.amount).toFixed(2)} at ${body.merchant}. Confirmation ${confirmation_id}.`
      : `Mock checkout ${confirmation_id} for $${Number(body.amount).toFixed(2)} at ${body.merchant} (set PRAVA_SECRET_KEY + PRAVA_PUBLISHABLE_KEY for live Collect).`;

  if (body.linq_chat_id) {
    await sendLinqChatMessage({
      chat_id: body.linq_chat_id,
      text: `Booked via Prava · ${confirmation_id}\n${body.merchant} · $${Number(body.amount).toFixed(2)}`,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    confirmation_id,
    summary,
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id,
        session_id: body.session_id,
        // No separate "mandate" object in the real API — the session itself
        // is the scoping unit, so this just mirrors session_id for the UI.
        mandate_id: body.session_id,
        token_ref: tokenRef,
        merchant: body.merchant,
        amount: Number(body.amount),
        mode: result.mode,
        summary,
      },
    },
  });
}
