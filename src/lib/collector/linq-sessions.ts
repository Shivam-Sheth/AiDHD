/**
 * Durable Linq chat sessions — same JSONBlob as WhatsApp so Vercel
 * cold starts don't restart the intro mid-thread.
 */
import {
  emptyDurable,
  loadDurable,
  saveDurable,
  type LinqDurableSession,
} from "../durable-state";

export type LinqSession = LinqDurableSession;

const memory = new Map<string, LinqSession>();
const processed = new Set<string>();
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  const remote = await loadDurable(true);
  if (remote?.linq_sessions) {
    for (const [k, v] of Object.entries(remote.linq_sessions)) {
      memory.set(k, v);
    }
  }
  for (const id of remote?.linq_processed_ids || []) {
    processed.add(id);
  }
  hydrated = true;
}

/** True if this webhook event was already handled (Linq retries). */
export async function claimLinqEvent(eventId: string): Promise<boolean> {
  if (!eventId) return true;
  await hydrate();
  if (processed.has(eventId)) return false;
  processed.add(eventId);
  // Persist claim so retries across cold starts don't double-send
  await persist();
  return true;
}

export async function getLinqSession(key: string): Promise<LinqSession> {
  await hydrate();
  return (
    memory.get(key) || {
      phase: "chat",
      updated_at: new Date().toISOString(),
    }
  );
}

export async function saveLinqSession(
  key: string,
  sess: LinqSession,
): Promise<void> {
  await hydrate();
  memory.set(key, {
    ...sess,
    updated_at: new Date().toISOString(),
  });
  await persist();
}

export async function clearLinqSession(key: string): Promise<void> {
  await hydrate();
  memory.delete(key);
  await persist();
}

export function linqSessionsSnapshot(): Record<string, LinqSession> {
  return Object.fromEntries(memory.entries());
}

export function linqProcessedSnapshot(): string[] {
  return [...processed].slice(-400);
}

/** Merge remote Linq fields so WhatsApp flush doesn't wipe them. */
export async function mergeLinqIntoPayload<T extends {
  linq_sessions?: Record<string, LinqSession>;
  linq_processed_ids?: string[];
}>(payload: T): Promise<T> {
  await hydrate();
  const remote = await loadDurable(false);
  return {
    ...payload,
    linq_sessions: {
      ...(remote?.linq_sessions || {}),
      ...linqSessionsSnapshot(),
    },
    linq_processed_ids: [
      ...new Set([
        ...(remote?.linq_processed_ids || []),
        ...linqProcessedSnapshot(),
      ]),
    ].slice(-400),
  };
}

async function persist(): Promise<void> {
  const remote = (await loadDurable(true)) || emptyDurable();
  await saveDurable({
    ...remote,
    linq_sessions: {
      ...(remote.linq_sessions || {}),
      ...linqSessionsSnapshot(),
    },
    linq_processed_ids: [
      ...new Set([
        ...(remote.linq_processed_ids || []),
        ...linqProcessedSnapshot(),
      ]),
    ].slice(-400),
  });
}
