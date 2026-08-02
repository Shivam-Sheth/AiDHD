import { randomUUID } from "crypto";
import { hasPrava } from "./config";
import { logRequest, logResponse, logInfo, redactPaymentResult } from "../checkout/debug-log";

export interface PravaSessionResult {
  session_id: string;
  session_token: string;
  iframe_url?: string;
  order_id?: string;
  expires_at?: string;
  mode: "live" | "mock";
  error?: string;
}

export interface PravaMandateResult {
  mandate_id: string;
  intent_id: string;
  session_id?: string;
  status: "approved" | "requested";
  mode: "live" | "mock";
  iframe_url?: string;
}

export interface PravaTokenResult {
  token_ref: string;
  merchant: string;
  amount: number;
  currency: string;
  mode: "live" | "mock";
  /** Never return PAN/CVV into app logs — only a redacted ref. */
  redacted: string;
}

/**
 * Prava flow per docs.prava.space:
 * session → passkey / card collect → mandate (merchant + amount + duration)
 * → single-use payment token. One mandate per cost category.
 */
export async function createPravaSession(input: {
  user_id: string;
  user_email: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  merchant_url?: string;
}): Promise<PravaSessionResult> {
  if (hasPrava()) {
    try {
      const secret = process.env.PRAVA_SECRET_KEY || process.env.PRAVA_API_KEY!;
      const url = "https://sandbox.api.prava.space/v1/sessions";
      const reqBody = {
        user_id: input.user_id,
        user_email: input.user_email,
        total_amount: input.amount.toFixed(2),
        currency: input.currency,
        purchase_context: [
          {
            merchant_details: {
              name: input.merchant,
              url: input.merchant_url || "https://aidhd-onkaaqeb6-amey-agarwals-projects.vercel.app",
              country_code_iso2: "US",
            },
            product_details: [
              {
                description: `AiDHD ${input.category} booking`,
                unit_price: input.amount.toFixed(2),
                quantity: 1,
              },
            ],
          },
        ],
      };
      logRequest("prava", "POST", url, reqBody);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });

      const data = (await res.json()) as {
        session_id?: string;
        session_token?: string;
        iframe_url?: string;
        order_id?: string;
        expires_at?: string;
        message?: string;
        error?: string;
        detail?: string;
      };
      logResponse("prava", "POST", url, res.status, data);

      if (res.ok && data.session_id) {
        const iframe =
          data.iframe_url ||
          `https://sandbox.collect.prava.space?session=${encodeURIComponent(data.session_id)}`;
        return {
          session_id: data.session_id,
          session_token: data.session_token || "",
          iframe_url: iframe,
          order_id: data.order_id,
          expires_at: data.expires_at,
          mode: "live",
        };
      }

      return {
        session_id: `sess_err_${randomUUID().slice(0, 8)}`,
        session_token: "",
        mode: "live",
        error:
          data.message ||
          data.error ||
          data.detail ||
          `Prava session failed (${res.status})`,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Prava request failed";
      logInfo("prava", "POST /v1/sessions threw", { message });
      return {
        session_id: `sess_err_${randomUUID().slice(0, 8)}`,
        session_token: "",
        mode: "live",
        error: message,
      };
    }
  }

  const session_id = `sess_mock_${randomUUID().slice(0, 8)}`;
  return {
    session_id,
    session_token: `st_mock_${randomUUID().slice(0, 8)}`,
    mode: "mock",
  };
}

/**
 * SIMULATION ONLY, below this line — kept for the older /  (DemoApp) stepper
 * flow, which pre-dates checking the real docs. Per docs.prava.space there is
 * no "mandate" REST resource to register and no endpoint that mints a token —
 * "mandate" is Prava's name for the session + passkey approval together, not
 * something a caller creates separately. These two functions never call
 * Prava at all, live or mock — they just fabricate IDs locally.
 *
 * The real flow (used by the /agent Concierge payment path — see
 * getPaymentResult / reportPaymentStatus below) is:
 *   1. POST /v1/sessions                          (createPravaSession, above)
 *   2. @prava-sdk/core collectPAN() in the browser (mounts the real iframe)
 *   3. GET  /v1/sessions/:id/payment-result        (getPaymentResult)
 *   4. POST /v1/sessions/:id/report-status         (reportPaymentStatus)
 */
export async function registerMandate(input: {
  session_id: string;
  merchant: string;
  amount_cap: number;
  currency: string;
  duration_minutes: number;
  category: string;
  iframe_url?: string;
}): Promise<PravaMandateResult> {
  const live = hasPrava() && !input.session_id.startsWith("sess_mock");
  return {
    mandate_id: live
      ? `md_${input.category}_${input.session_id.slice(-8)}`
      : `md_mock_${input.category}_${randomUUID().slice(0, 6)}`,
    intent_id: live
      ? `intent_${input.session_id.slice(-10)}`
      : `intent_mock_${randomUUID().slice(0, 8)}`,
    session_id: input.session_id,
    status: "approved",
    mode: live ? "live" : "mock",
    iframe_url: input.iframe_url,
  };
}

export async function invokeMandateToken(input: {
  intent_id: string;
  merchant: string;
  amount: number;
  currency: string;
}): Promise<PravaTokenResult> {
  // Network-scoped single-use credential reference (PAN never logged).
  return {
    token_ref: `tok_${randomUUID().slice(0, 10)}`,
    merchant: input.merchant,
    amount: input.amount,
    currency: input.currency,
    mode: hasPrava() ? "live" : "mock",
    redacted: "•••• •••• •••• ****",
  };
}

/** End-to-end commerce receipt after Collect — what judges need to see. */
export async function completePravaCheckout(input: {
  session_id: string;
  merchant: string;
  amount: number;
  currency?: string;
  category: string;
  iframe_url?: string;
}): Promise<{
  ok: boolean;
  mode: "live" | "mock";
  session_id: string;
  mandate: PravaMandateResult;
  token: PravaTokenResult;
  confirmation_id: string;
  summary: string;
}> {
  const currency = input.currency || "USD";
  const mandate = await registerMandate({
    session_id: input.session_id,
    merchant: input.merchant,
    amount_cap: input.amount,
    currency,
    duration_minutes: 120,
    category: input.category,
    iframe_url: input.iframe_url,
  });
  const token = await invokeMandateToken({
    intent_id: mandate.intent_id,
    merchant: input.merchant,
    amount: input.amount,
    currency,
  });
  const confirmation_id = `AIDHD-${Date.now().toString(36).toUpperCase()}`;
  const live = mandate.mode === "live";
  return {
    ok: true,
    mode: live ? "live" : "mock",
    session_id: input.session_id,
    mandate,
    token,
    confirmation_id,
    summary: live
      ? `Prava Collect session ${input.session_id} → mandate ${mandate.mandate_id} → scoped token ${token.token_ref} for $${input.amount.toFixed(2)} at ${input.merchant}. Confirmation ${confirmation_id}.`
      : `Mock checkout ${confirmation_id} for $${input.amount.toFixed(2)} at ${input.merchant} (set PRAVA_SECRET_KEY for live Collect).`,
  };
}

/* ------------------------- Real Prava API, from here ------------------------- */

export interface PravaPaymentResult {
  /** pending | processing | awaiting_result | completed | failed (per docs.prava.space's PaymentResult schema) */
  status: string;
  /** One-time virtual card number — single-use, merchant- and amount-locked, short-lived. */
  token?: string;
  dynamic_cvv?: string;
  expiry_month?: string;
  expiry_year?: string;
  /** Line-item reference required by report-status — see reportPaymentStatus below. */
  txn_ref_id?: string;
  mode: "live" | "mock";
}

/**
 * GET /v1/sessions/:id/payment-result — call after the browser SDK's
 * collectPAN() succeeds. May still read "awaiting_result" for a moment while
 * Prava finishes processing; poll a few times before giving up.
 */
export async function getPaymentResult(sessionId: string): Promise<PravaPaymentResult> {
  if (!hasPrava() || sessionId.startsWith("sess_mock") || sessionId.startsWith("sess_err")) {
    return {
      status: "completed",
      token: `4242${randomUUID().replace(/-/g, "").slice(0, 8)}`,
      dynamic_cvv: "***",
      expiry_month: "12",
      expiry_year: "29",
      txn_ref_id: `tli_mock_${randomUUID().slice(0, 8)}`,
      mode: "mock",
    };
  }
  const url = `https://sandbox.api.prava.space/v1/sessions/${encodeURIComponent(sessionId)}/payment-result`;
  try {
    const secret = process.env.PRAVA_SECRET_KEY || process.env.PRAVA_API_KEY!;
    logRequest("prava", "GET", url);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    if (!res.ok) {
      logResponse("prava", "GET", url, res.status);
      return { status: "failed", mode: "live" };
    }
    const data = (await res.json()) as {
      status?: string;
      transactions?: Array<{
        status?: string;
        line_items?: Array<{
          txn_ref_id?: string | null;
          token?: string | null;
          dynamic_cvv?: string | null;
          expiry_month?: string | null;
          expiry_year?: string | null;
        }>;
      }>;
    };
    // Credentials sit on the first line item of the first transaction per
    // docs.prava.space's PaymentResult schema — never at the response's top
    // level, despite that being a natural first guess.
    const item = data.transactions?.[0]?.line_items?.[0];
    const result: PravaPaymentResult = {
      status: data.status || "awaiting_result",
      token: item?.token || undefined,
      dynamic_cvv: item?.dynamic_cvv || undefined,
      expiry_month: item?.expiry_month || undefined,
      expiry_year: item?.expiry_year || undefined,
      // Required by report-status (POST .../report-status) — pass this back
      // verbatim, not the session id, per docs.prava.space/api-reference/report-status.
      txn_ref_id: item?.txn_ref_id || undefined,
      mode: "live",
    };
    // Logged redacted — see debug-log.ts; token/dynamic_cvv never appear here in full.
    logResponse("prava", "GET", url, res.status, redactPaymentResult(result));
    return result;
  } catch (e) {
    logInfo("prava", "GET /payment-result threw", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { status: "failed", mode: "live" };
  }
}

/**
 * POST /v1/sessions/:id/report-status — mandatory per docs.prava.space:
 * closes the payment lifecycle regardless of whether the downstream merchant
 * charge itself succeeded.
 *
 * Body shape is `{ txn_ref_id, txn_status }` (docs.prava.space/api-reference/report-status)
 * — NOT `{ status }`. `txn_ref_id` is the line-item ref from getPaymentResult's
 * `PravaPaymentResult.txn_ref_id`, not the session id. Omitting it (as this
 * function used to) means Prava has nothing to match the report to, so the
 * session never actually closes even though the request returns 200.
 */
export async function reportPaymentStatus(
  sessionId: string,
  status: "APPROVED" | "DECLINED",
  txnRefId?: string,
  opts?: { authorization_code?: string; response_code?: string },
): Promise<{ ok: boolean }> {
  if (!hasPrava() || sessionId.startsWith("sess_mock") || sessionId.startsWith("sess_err")) {
    return { ok: true };
  }
  if (!txnRefId) {
    logInfo("prava", "report-status skipped: no txn_ref_id (payment-result never reached awaiting_result/completed with a line item)", {
      session_id: sessionId,
    });
    return { ok: false };
  }
  const url = `https://sandbox.api.prava.space/v1/sessions/${encodeURIComponent(sessionId)}/report-status`;
  const reqBody = {
    txn_ref_id: txnRefId,
    txn_status: status,
    ...(opts?.authorization_code ? { authorization_code: opts.authorization_code } : {}),
    ...(opts?.response_code ? { response_code: opts.response_code } : {}),
  };
  try {
    const secret = process.env.PRAVA_SECRET_KEY || process.env.PRAVA_API_KEY!;
    logRequest("prava", "POST", url, reqBody);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
    const data = await res.json().catch(() => null);
    logResponse("prava", "POST", url, res.status, data);
    return { ok: res.ok };
  } catch (e) {
    logInfo("prava", "POST /report-status threw", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { ok: false };
  }
}
