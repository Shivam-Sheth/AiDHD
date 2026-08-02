/**
 * Request/response tracing for the Prava → Duffel checkout flow, for local
 * debugging. Card PAN/CVV are always redacted here to last-4/presence-only —
 * see the credential-handling boundary in app/api/checkout/execute/route.ts
 * for why full values must never reach a logger.
 */

export function logRequest(tag: string, method: string, url: string, body?: unknown) {
  console.log(`[${tag}] → ${method} ${url}`, body !== undefined ? JSON.stringify(body) : "");
}

export function logResponse(tag: string, method: string, url: string, status: number, body?: unknown) {
  console.log(`[${tag}] ← ${status} ${method} ${url}`, body !== undefined ? JSON.stringify(body) : "");
}

export function logInfo(tag: string, message: string, data?: unknown) {
  console.log(`[${tag}] ${message}`, data !== undefined ? JSON.stringify(data) : "");
}

/** Redacts a card-shaped object's PAN to last-4 and CVV to presence-only. */
export function redactCard<T extends { number?: string; cvc?: string }>(card: T): T {
  return {
    ...card,
    number: card.number ? `•••• ${card.number.slice(-4)}` : card.number,
    cvc: card.cvc ? "•••" : card.cvc,
  };
}

/** Redacts a Prava payment-result-shaped object's token/dynamic_cvv. */
export function redactPaymentResult<T extends { token?: string; dynamic_cvv?: string }>(
  result: T,
): T {
  return {
    ...result,
    token: result.token ? `•••• ${result.token.slice(-4)}` : result.token,
    dynamic_cvv: result.dynamic_cvv ? "•••" : result.dynamic_cvv,
  };
}
