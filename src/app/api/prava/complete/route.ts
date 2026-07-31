import { NextResponse } from "next/server";
import { completePravaCheckout } from "@/lib/integrations/prava";
import { sendLinqChatMessage } from "@/lib/integrations/linq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * After the user finishes Prava Collect (passkey/card), finalize the commerce
 * receipt: mandate → scoped token ref → confirmation id.
 * Optional Linq chat_id gets an in-thread confirmation (links OK on follow-up).
 */
export async function POST(req: Request) {
  let body: {
    session_id?: string;
    merchant?: string;
    amount?: number;
    currency?: string;
    category?: string;
    iframe_url?: string;
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

  const result = await completePravaCheckout({
    session_id: body.session_id,
    merchant: body.merchant,
    amount: Number(body.amount),
    currency: body.currency || "USD",
    category: body.category || "trip",
    iframe_url: body.iframe_url,
  });

  if (body.linq_chat_id) {
    await sendLinqChatMessage({
      chat_id: body.linq_chat_id,
      text: `Booked via Prava · ${result.confirmation_id}\n${body.merchant} · $${Number(body.amount).toFixed(2)}\nMandate ${result.mandate.mandate_id}`,
    });
  }

  return NextResponse.json({
    ...result,
    ui: {
      kind: "receipt",
      payload: {
        confirmation_id: result.confirmation_id,
        session_id: result.session_id,
        mandate_id: result.mandate.mandate_id,
        token_ref: result.token.token_ref,
        merchant: body.merchant,
        amount: Number(body.amount),
        mode: result.mode,
        summary: result.summary,
      },
    },
  });
}
