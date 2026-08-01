import { NextResponse } from "next/server";
import { getPaymentResult, reportPaymentStatus } from "@/lib/integrations/prava";
import { sendLinqChatMessage } from "@/lib/integrations/linq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called right after @prava-sdk/core's collectPAN() succeeds in the browser.
 * Real flow: GET payment-result (poll briefly — it can read "awaiting_result"
 * for a moment) → POST report-status (mandatory, closes the loop with Prava).
 *
 * The one-time virtual card returned here isn't submitted to a real merchant
 * checkout yet — Ticketmaster/Duffel integrations in this repo are search /
 * mock-reserve only (disclosed in README) — so we report APPROVED because the
 * enrollment itself succeeded. Swap that for the merchant's real charge
 * outcome once a live checkout call exists.
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

  if (!body.session_id || !body.merchant || body.amount == null) {
    return NextResponse.json(
      { error: "session_id, merchant, amount required" },
      { status: 400 },
    );
  }

  let result = await getPaymentResult(body.session_id);
  for (let i = 0; i < 5 && result.status === "awaiting_result"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await getPaymentResult(body.session_id);
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
