import { getPaymentResult, type PravaPaymentResult } from "../integrations/prava";
import { logInfo } from "./debug-log";

export const DEFAULT_POLL_INTERVAL_MS = 750;
export const DEFAULT_POLL_TIMEOUT_MS = 30_000;

// Still waiting on the cardholder / Prava — keep polling.
const WAITING_STATUSES = new Set(["pending", "processing"]);

export type PollOutcome =
  | { ok: true; result: PravaPaymentResult }
  | { ok: false; reason: "timeout" | "declined"; last_status: string };

/**
 * Polls Prava's payment-result endpoint until the one-time credentials are
 * ready, or `timeoutMs` elapses.
 *
 * IMPORTANT: "awaiting_result" is NOT a pending/transient status to wait
 * out — per docs.prava.space/concepts/checkout-flow, it's the terminal
 * *ready* state: "Verified—credentials issued, checkout in progress." The
 * "completed"/"failed" statuses only appear AFTER the caller spends the
 * credentials and calls report-status — Prava never transitions to
 * "completed" on its own. Treating "awaiting_result" as pending (as this
 * function used to) means it can never succeed: it would poll until
 * timeout every single time, since nothing server-side ever moves the
 * status past "awaiting_result" without our own report-status call closing
 * the loop. The actual success signal is the credentials themselves
 * (token + dynamic_cvv) being present, not a specific status string.
 */
export async function pollForCompletedPayment(
  sessionId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<PollOutcome> {
  const intervalMs = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let attempt = 1;
  let result = await getPaymentResult(sessionId);
  logInfo("poll", `attempt ${attempt} status=${result.status}`);
  while (
    WAITING_STATUSES.has(result.status) &&
    !(result.token && result.dynamic_cvv) &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, intervalMs));
    attempt += 1;
    result = await getPaymentResult(sessionId);
    logInfo("poll", `attempt ${attempt} status=${result.status}`);
  }

  if (result.token && result.dynamic_cvv) {
    logInfo("poll", `credentials ready after ${attempt} attempt(s) (status=${result.status})`);
    return { ok: true, result };
  }
  const reason = WAITING_STATUSES.has(result.status) ? "timeout" : "declined";
  logInfo("poll", `gave up after ${attempt} attempt(s): ${reason} (last status: ${result.status})`);
  return { ok: false, reason, last_status: result.status };
}
