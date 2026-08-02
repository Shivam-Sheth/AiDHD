import { NextResponse } from "next/server";
import { reportPaymentStatus } from "@/lib/integrations/prava";
import { pollForCompletedPayment } from "@/lib/checkout/poll-payment-result";
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

  const polled = await pollForCompletedPayment(body.session_id, { intervalMs: 1000, timeoutMs: 6000 });
  if (!polled.ok) {
    await reportPaymentStatus(body.session_id, "DECLINED").catch(() => {});
    return NextResponse.json(
      { ok: false, error: `Payment not completed (${polled.reason}, last status: ${polled.last_status})` },
      { status: 402 },
    );
  }
  const result = polled.result;

  await reportPaymentStatus(body.session_id, "APPROVED", result.txn_ref_id);

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
