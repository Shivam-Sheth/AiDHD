/**
 * Cross-instance persistence for WhatsApp on Vercel serverless.
 * In-memory Maps alone reset between cold starts → "Hey I'm AiDHD" mid-flow.
 *
 * Backend: JSONBlob (no auth). Set AIDHD_STATE_BLOB_ID (or full AIDHD_STATE_BLOB_URL).
 */
import type { CollectorSession, Package, Response } from "./types";
import type { WhatsAppContact } from "./integrations/whatsapp-phonebook";

export type DurablePayload = {
  v: 1;
  updated_at: string;
  contacts: WhatsAppContact[];
  collectors: CollectorSession[];
  responses: Response[];
  packages: Package[];
  processed_message_ids: string[];
};

const EMPTY: DurablePayload = {
  v: 1,
  updated_at: new Date(0).toISOString(),
  contacts: [],
  collectors: [],
  responses: [],
  packages: [],
  processed_message_ids: [],
};

function blobUrl(): string | null {
  const full = process.env.AIDHD_STATE_BLOB_URL?.trim();
  if (full) return full.replace(/\/$/, "");
  const id = process.env.AIDHD_STATE_BLOB_ID?.trim();
  if (id) return `https://jsonblob.com/api/jsonBlob/${id}`;
  return null;
}

let hydratePromise: Promise<DurablePayload | null> | null = null;
let lastLoadedAt = 0;
let writeChain: Promise<void> = Promise.resolve();

export function hasDurableBackend(): boolean {
  return Boolean(blobUrl());
}

async function fetchPayload(): Promise<DurablePayload | null> {
  const url = blobUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DurablePayload;
    if (!data || data.v !== 1) return null;
    return data;
  } catch (err) {
    console.error("[durable] load failed", err);
    return null;
  }
}

/** Load once per warm instance (or force refresh). */
export async function loadDurable(
  force = false,
): Promise<DurablePayload | null> {
  if (!blobUrl()) return null;
  const stale = Date.now() - lastLoadedAt > 2_000;
  if (!force && hydratePromise && !stale) return hydratePromise;
  hydratePromise = (async () => {
    const data = await fetchPayload();
    lastLoadedAt = Date.now();
    return data;
  })();
  return hydratePromise;
}

function slimCollector(session: CollectorSession): CollectorSession {
  const msgs = session.messages ?? [];
  return {
    ...session,
    messages: msgs.slice(-24),
  };
}

export async function saveDurable(payload: DurablePayload): Promise<void> {
  const url = blobUrl();
  if (!url) return;

  const body: DurablePayload = {
    ...payload,
    v: 1,
    updated_at: new Date().toISOString(),
    collectors: payload.collectors.map(slimCollector),
    processed_message_ids: payload.processed_message_ids.slice(-400),
  };

  writeChain = writeChain
    .then(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error("[durable] save status", res.status);
      }
      lastLoadedAt = Date.now();
      hydratePromise = Promise.resolve(body);
    })
    .catch((err) => {
      console.error("[durable] save failed", err);
    });

  await writeChain;
}

export function emptyDurable(): DurablePayload {
  return { ...EMPTY, updated_at: new Date().toISOString() };
}
