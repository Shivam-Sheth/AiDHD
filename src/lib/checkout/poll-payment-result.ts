import { getPaymentResult, type PravaPaymentResult } from "../integrations/prava";

export const DEFAULT_POLL_INTERVAL_MS = 750;
export const DEFAULT_POLL_TIMEOUT_MS = 30_000;

const PENDING_STATUSES = new Set(["pending", "processing", "awaiting_result"]);

export type PollOutcome =
  | { ok: true; result: PravaPaymentResult }
  | { ok: false; reason: "timeout" | "declined"; last_status: string };

/**
 * Polls Prava's payment-result endpoint until status is "completed" — the
 * terminal success state — or `timeoutMs` elapses. `pending` / `processing` /
 * `awaiting_result` are all transient per getPaymentResult's doc comment in
 * integrations/prava.ts ("may still read awaiting_result for a moment while
 * Prava finishes processing"); anything else is treated as a terminal
 * decline so callers don't spin for the full timeout on a hard failure.
 */
export async function pollForCompletedPayment(
  sessionId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<PollOutcome> {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let result = await getPaymentResult(sessionId);
  while (PENDING_STATUSES.has(result.status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    result = await getPaymentResult(sessionId);
  }

  if (result.status === "completed") {
    return { ok: true, result };
  }
  const reason = PENDING_STATUSES.has(result.status) ? "timeout" : "declined";
  return { ok: false, reason, last_status: result.status };
}
