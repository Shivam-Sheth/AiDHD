/**
 * Request/response tracing for the Prava → merchant checkout flow, for local
 * debugging. Card PAN/CVV are always redacted here to last-4/presence-only —
 * see the credential-handling boundary in
 * app/api/checkout/shopify-execute/route.ts for why full values must never
 * reach a logger.
 */

export type DebugLogEntry = {
  id: number;
  ts: string;
  tag: string;
  message: string;
  data?: unknown;
};

type DebugBus = {
  buffer: DebugLogEntry[];
  subscribers: Set<(entry: DebugLogEntry) => void>;
  nextId: number;
};

const BUFFER_LIMIT = 500;

// Kept on globalThis so it survives Next.js dev-mode HMR, same pattern as
// lib/store.ts's in-memory demo store.
const globalForDebugBus = globalThis as unknown as { __aidhdDebugBus?: DebugBus };

function getBus(): DebugBus {
  if (!globalForDebugBus.__aidhdDebugBus) {
    globalForDebugBus.__aidhdDebugBus = { buffer: [], subscribers: new Set(), nextId: 1 };
  }
  return globalForDebugBus.__aidhdDebugBus;
}

function publish(tag: string, message: string, data?: unknown) {
  const bus = getBus();
  const entry: DebugLogEntry = { id: bus.nextId++, ts: new Date().toISOString(), tag, message, data };
  bus.buffer.push(entry);
  if (bus.buffer.length > BUFFER_LIMIT) bus.buffer.shift();
  for (const sub of bus.subscribers) {
    try {
      sub(entry);
    } catch {
      // A broken subscriber (e.g. a closed SSE stream) must never break logging.
    }
  }
}

/** Live entries as they're published — returns an unsubscribe function. */
export function subscribeDebugLog(cb: (entry: DebugLogEntry) => void): () => void {
  const bus = getBus();
  bus.subscribers.add(cb);
  return () => bus.subscribers.delete(cb);
}

/** Buffered entries published before a client connected (most recent 500). */
export function getDebugLogHistory(): DebugLogEntry[] {
  return [...getBus().buffer];
}

export function logRequest(tag: string, method: string, url: string, body?: unknown) {
  console.log(`[${tag}] → ${method} ${url}`, body !== undefined ? JSON.stringify(body) : "");
  publish(tag, `→ ${method} ${url}`, body);
}

export function logResponse(tag: string, method: string, url: string, status: number, body?: unknown) {
  console.log(`[${tag}] ← ${status} ${method} ${url}`, body !== undefined ? JSON.stringify(body) : "");
  publish(tag, `← ${status} ${method} ${url}`, body);
}

export function logInfo(tag: string, message: string, data?: unknown) {
  console.log(`[${tag}] ${message}`, data !== undefined ? JSON.stringify(data) : "");
  publish(tag, message, data);
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
