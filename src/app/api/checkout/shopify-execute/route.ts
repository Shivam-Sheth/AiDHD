import { NextResponse } from "next/server";
import { executeShopifyPurchase } from "@/lib/checkout/shopify-purchase";
import { logInfo } from "@/lib/checkout/debug-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps configurable maxDuration at 60s (default compute) — a real
// headless-browser checkout run (page load + fill + submit + wait for the
// order-confirmation redirect) needs most of that. If this route times out
// in practice, that's the first thing to check (Vercel plan/Fluid Compute),
// not the automation logic.
export const maxDuration = 60;

type ExecuteShopifyCheckoutBody = {
  session_id?: string;
  merchant?: string;
  amount?: number;
  variant_id?: string;
  email?: string;
  cardholder_name?: string;
};

/**
 * Backend half of the checkout flow for Shopify-sourced legs — the caller has
 * already created the Prava session and gotten passkey/card-collect approval
 * before this fires. The pipeline itself lives in checkout/shopify-purchase.ts
 * so the chat agents can run the identical flow without an HTTP hop.
 */
export async function POST(req: Request) {
  let body: ExecuteShopifyCheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, merchant, amount, variant_id, email } = body;
  logInfo("shopify execute", "incoming request", { session_id, merchant, amount, variant_id });
  if (!session_id || !merchant || amount == null || !variant_id || !email) {
    return NextResponse.json(
      { ok: false, error: "session_id, merchant, amount, variant_id, email required" },
      { status: 400 },
    );
  }

  const result = await executeShopifyPurchase({
    session_id,
    merchant,
    amount,
    variant_id,
    email,
    cardholder_name: body.cardholder_name,
  });

  if (!result.ok) {
    const status = result.error_code === "payment_not_ready" ? 402 : 502;
    return NextResponse.json(
      { ok: false, error_code: result.error_code, error: result.error },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    confirmation_id: result.confirmation_id,
    summary: result.summary,
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id: result.confirmation_id,
        session_id,
        mandate_id: session_id,
        token_ref: result.token_ref,
        merchant,
        amount: Number(amount),
        mode: "live",
        summary: result.summary,
        shopify_order_url: result.final_url,
      },
    },
  });
}
