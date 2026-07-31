/**
 * In-memory bus so tool results can paint cards when ElevenLabs
 * runs webhooks (server-side).
 */

export type UiEnvelope = {
  kind: string;
  payload: unknown;
  at: number;
  tool?: string;
};

type BusStore = {
  recent: UiEnvelope[];
  bySession: Map<string, UiEnvelope[]>;
  byConversation: Map<string, UiEnvelope[]>;
};

const g = globalThis as unknown as { __aidhdUiBus?: BusStore };

function store(): BusStore {
  if (!g.__aidhdUiBus) {
    g.__aidhdUiBus = {
      recent: [],
      bySession: new Map(),
      byConversation: new Map(),
    };
  }
  return g.__aidhdUiBus;
}

function push(map: Map<string, UiEnvelope[]>, key: string, item: UiEnvelope) {
  if (!key) return;
  const prev = map.get(key) || [];
  map.set(key, [item, ...prev].slice(0, 20));
}

export function publishUi(opts: {
  session?: string | null;
  conversation_id?: string | null;
  tool?: string;
  ui?: { kind: string; payload: unknown } | null;
}) {
  if (!opts.ui) return;
  const item: UiEnvelope = {
    kind: opts.ui.kind,
    payload: opts.ui.payload,
    at: Date.now(),
    tool: opts.tool,
  };
  const s = store();
  s.recent = [item, ...s.recent].slice(0, 30);
  if (opts.session) push(s.bySession, opts.session, item);
  if (opts.conversation_id) push(s.byConversation, opts.conversation_id, item);
}

export function readUi(opts: {
  session?: string | null;
  conversation_id?: string | null;
  since?: number;
}): UiEnvelope[] {
  const s = store();
  const bags: UiEnvelope[] = [...s.recent];
  if (opts.session) bags.push(...(s.bySession.get(opts.session) || []));
  if (opts.conversation_id) {
    bags.push(...(s.byConversation.get(opts.conversation_id) || []));
  }
  const since = opts.since ?? 0;
  const seen = new Set<string>();
  const out: UiEnvelope[] = [];
  for (const item of bags.sort((a, b) => b.at - a.at)) {
    const key = `${item.at}:${item.kind}:${item.tool || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.at > since) out.push(item);
  }
  return out.slice(0, 12);
}
