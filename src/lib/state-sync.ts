/**
 * Hydrate / flush in-memory store + WhatsApp phonebook from durable blob.
 */
import {
  emptyDurable,
  loadDurable,
  saveDurable,
  type DurablePayload,
} from "./durable-state";
import { mergeLinqIntoPayload } from "./collector/linq-sessions";
import {
  listProcessedMessageIds,
  listWhatsAppContacts,
  replaceWhatsAppBook,
} from "./integrations/whatsapp-phonebook";
import { collectorKey, ensureSeeded, getStore } from "./store";

let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function stepRank(step: string): number {
  const order = [
    "budget",
    "origin",
    "destination",
    "availability",
    "preferences",
    "confirm",
    "done",
  ];
  const i = order.indexOf(step);
  return i < 0 ? 0 : i;
}

export async function hydrateAidhdState(): Promise<void> {
  ensureSeeded();
  const remote = await loadDurable(true);
  if (!remote) {
    hydrated = true;
    return;
  }

  const store = getStore();

  if (remote.contacts?.length) {
    replaceWhatsAppBook({
      contacts: remote.contacts,
      processedMessageIds: remote.processed_message_ids ?? [],
    });
  }

  for (const session of remote.collectors ?? []) {
    if (!session?.event_id || !session?.user_id) continue;
    const key = collectorKey(session.event_id, session.user_id);
    const local = store.collectors.get(key);
    if (local && stepRank(local.step) > stepRank(session.step)) continue;
    store.collectors.set(key, session);
  }

  for (const r of remote.responses ?? []) {
    if (!r?.id) continue;
    if (!store.responses.has(r.id)) store.responses.set(r.id, r);
  }

  for (const p of remote.packages ?? []) {
    if (!p?.id) continue;
    store.packages.set(p.id, p);
  }

  hydrated = true;
}

function snapshot(): DurablePayload {
  ensureSeeded();
  const store = getStore();
  return {
    v: 1,
    updated_at: new Date().toISOString(),
    contacts: listWhatsAppContacts(),
    collectors: [...store.collectors.values()],
    responses: [...store.responses.values()],
    packages: [...store.packages.values()],
    processed_message_ids: listProcessedMessageIds(),
  };
}

/** Debounced durable write — call after collector / response / package / contact changes. */
export function scheduleDurableFlush(): void {
  if (!process.env.AIDHD_STATE_BLOB_ID && !process.env.AIDHD_STATE_BLOB_URL) {
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushDurableNow();
  }, 80);
}

export async function flushDurableNow(): Promise<void> {
  if (!process.env.AIDHD_STATE_BLOB_ID && !process.env.AIDHD_STATE_BLOB_URL) {
    return;
  }
  ensureSeeded();
  if (!hydrated) await hydrateAidhdState();
  const payload = await mergeLinqIntoPayload(snapshot());
  if (
    !payload.contacts.length &&
    !payload.collectors.length &&
    !payload.responses.length
  ) {
    const remote = await loadDurable(true);
    if (remote && (remote.contacts.length || remote.collectors.length)) {
      return;
    }
  }
  await saveDurable(payload);
}

export async function ensureHydrated(): Promise<void> {
  if (!process.env.AIDHD_STATE_BLOB_ID && !process.env.AIDHD_STATE_BLOB_URL) {
    hydrated = true;
    return;
  }
  if (hydrated) {
    const remote = await loadDurable(false);
    if (!remote) return;
    const store = getStore();
    for (const session of remote.collectors ?? []) {
      const key = collectorKey(session.event_id, session.user_id);
      if (!store.collectors.has(key)) store.collectors.set(key, session);
      else {
        const local = store.collectors.get(key)!;
        if (stepRank(session.step) > stepRank(local.step)) {
          store.collectors.set(key, session);
        }
      }
    }
    for (const r of remote.responses ?? []) {
      if (r?.id && !store.responses.has(r.id)) store.responses.set(r.id, r);
    }
    for (const p of remote.packages ?? []) {
      if (p?.id) store.packages.set(p.id, p);
    }
    // Merge contacts by phone — remote fills gaps
    if (remote.contacts?.length) {
      const local = listWhatsAppContacts();
      const byPhone = new Map(local.map((c) => [c.phone, c]));
      let changed = false;
      for (const c of remote.contacts) {
        if (!byPhone.has(c.phone)) {
          byPhone.set(c.phone, c);
          changed = true;
        } else {
          const cur = byPhone.get(c.phone)!;
          if (!cur.collector_checkpoint && c.collector_checkpoint) {
            cur.collector_checkpoint = c.collector_checkpoint;
            changed = true;
          }
          if (!cur.event_id && c.event_id) {
            cur.event_id = c.event_id;
            changed = true;
          }
          if (c.planning_intro_sent && !cur.planning_intro_sent) {
            cur.planning_intro_sent = true;
            changed = true;
          }
        }
      }
      if (changed || !local.length) {
        replaceWhatsAppBook({
          contacts: [...byPhone.values()],
          processedMessageIds: [
            ...new Set([
              ...listProcessedMessageIds(),
              ...(remote.processed_message_ids ?? []),
            ]),
          ],
        });
      }
    }
    return;
  }
  await hydrateAidhdState();
}

export { emptyDurable };
