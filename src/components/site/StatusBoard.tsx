"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Reads the same `/api/health` endpoint the app uses, and reports exactly
 * what it says. Pact degrades to mocks/fixtures whenever a key is absent
 * (see src/lib/integrations/config.ts), so "not live" is a normal operating
 * mode here, not an outage — the legend below says so rather than painting
 * everything green.
 */

type Health = {
  integrations?: Record<string, string>;
};

const GROUPS: { title: string; blurb: string; keys: string[] }[] = [
  {
    title: "Payments & checkout",
    blurb: "Per-category mandates and the merchant checkout leg.",
    keys: ["prava", "shopify", "browserbase"],
  },
  {
    title: "Travel & event inventory",
    blurb: "What the planning agents can actually search and book.",
    keys: ["duffel", "duffel_stays", "ticketmaster"],
  },
  {
    title: "Messaging channels",
    blurb: "How groups collect budgets and receive confirmations.",
    keys: ["whatsapp", "linq", "twilio"],
  },
  {
    title: "Agents & intelligence",
    blurb: "The planning subnet, its models, and vendor trust scoring.",
    keys: ["agents", "gemini", "openai", "senso", "nanda"],
  },
  {
    title: "Voice & location",
    blurb: "Spoken confirmations and map/venue enrichment.",
    keys: ["elevenlabs", "eleven_agents", "google_maps"],
  },
];

const LABELS: Record<string, string> = {
  prava: "Prava payments",
  shopify: "Shopify storefront",
  browserbase: "Browserbase checkout harness",
  duffel: "Duffel flights",
  duffel_stays: "Duffel stays",
  ticketmaster: "Ticketmaster events",
  whatsapp: "WhatsApp (Meta)",
  linq: "Linq / iMessage",
  twilio: "Twilio SMS",
  agents: "Planning subnet",
  gemini: "Gemini",
  openai: "OpenAI",
  senso: "Senso vendor trust",
  nanda: "NANDA network",
  elevenlabs: "ElevenLabs voice",
  eleven_agents: "ElevenAgents outbound",
  google_maps: "Google Maps",
};

/** How each status string from integrationStatus() is presented. */
const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; chip: string }
> = {
  live: {
    label: "Live",
    dot: "bg-[var(--success)]",
    text: "text-[var(--success)]",
    chip: "bg-[var(--success-soft)]",
  },
  registered: {
    label: "Registered",
    dot: "bg-[var(--success)]",
    text: "text-[var(--success)]",
    chip: "bg-[var(--success-soft)]",
  },
  subnet: {
    label: "Running",
    dot: "bg-[var(--success)]",
    text: "text-[var(--success)]",
    chip: "bg-[var(--success-soft)]",
  },
  standby: {
    label: "Standby",
    dot: "bg-[var(--faint)]",
    text: "text-[var(--muted)]",
    chip: "bg-[var(--surface-2)]",
  },
  fixture: {
    label: "Fixtures",
    dot: "bg-[var(--warning)]",
    text: "text-[var(--warning)]",
    chip: "bg-[var(--warning-soft)]",
  },
  mock: {
    label: "Mock",
    dot: "bg-[var(--warning)]",
    text: "text-[var(--warning)]",
    chip: "bg-[var(--warning-soft)]",
  },
};

const FALLBACK_META = {
  label: "Unknown",
  dot: "bg-[var(--faint)]",
  text: "text-[var(--muted)]",
  chip: "bg-[var(--surface-2)]",
};

const LEGEND: { status: string; meaning: string }[] = [
  {
    status: "live",
    meaning: "Real credentials configured — calls hit the provider.",
  },
  {
    status: "fixture",
    meaning: "Serving recorded inventory. Plans build, bookings are simulated.",
  },
  {
    status: "mock",
    meaning: "Synthetic responses. The flow works end to end, the data does not.",
  },
  {
    status: "standby",
    meaning: "Configured as a fallback — idle unless the primary is unavailable.",
  },
];

async function fetchHealth(): Promise<Record<string, string>> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check returned ${res.status}`);
  const data: Health = await res.json();
  return data.integrations ?? {};
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? FALLBACK_META;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip} ${meta.text}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function StatusBoard() {
  const [integrations, setIntegrations] = useState<Record<string, string> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Promise chain rather than async/await, and state is only ever written
   *  from a callback — a setState reached synchronously from the polling
   *  effect below would cascade a render on every mount. */
  const check = useCallback(
    () =>
      fetchHealth()
        .then((next) => {
          setIntegrations(next);
          setError(null);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Health check failed");
        })
        .finally(() => setCheckedAt(new Date().toLocaleTimeString())),
    [],
  );

  const refresh = useCallback(() => {
    setBusy(true);
    void check().finally(() => setBusy(false));
  }, [check]);

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), 60_000);
    return () => clearInterval(id);
  }, [check]);

  // `llm` names which provider is primary rather than describing a service of
  // its own — it reads as a note, not a row.
  const primaryLlm = integrations?.llm;
  const rows = Object.entries(integrations ?? {}).filter(([k]) => k !== "llm");
  const grouped = GROUPS.map((g) => ({
    ...g,
    entries: g.keys
      .filter((k) => k in (integrations ?? {}))
      .map((k) => [k, (integrations as Record<string, string>)[k]] as const),
  })).filter((g) => g.entries.length);
  const ungrouped = rows.filter(
    ([k]) => !GROUPS.some((g) => g.keys.includes(k)),
  );

  const liveCount = rows.filter(([, v]) =>
    ["live", "registered", "subnet"].includes(v),
  ).length;

  const reachable = !error && integrations !== null;

  return (
    <div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                reachable ? "bg-[var(--success)]" : "bg-[var(--danger)]"
              }`}
            />
            <div>
              <p className="font-display text-xl font-semibold text-[var(--ink)]">
                {integrations === null && !error
                  ? "Checking…"
                  : reachable
                    ? "API reachable"
                    : "API unreachable"}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {error
                  ? error
                  : integrations === null
                    ? "Reading /api/health."
                    : liveCount === rows.length
                      ? `All ${rows.length} integrations are running live.`
                      : `${liveCount} of ${rows.length} integrations running live. The rest are on fixtures, mocks, or standby — see the legend below.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {checkedAt ? (
              <span className="text-xs text-[var(--faint)]">
                Checked {checkedAt}
              </span>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              disabled={busy}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--coral)] disabled:opacity-50"
            >
              {busy ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>

        {primaryLlm ? (
          <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              Primary model provider:
            </span>{" "}
            {primaryLlm}
          </p>
        ) : null}
      </div>

      <div className="mt-10 space-y-8">
        {grouped.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              {group.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{group.blurb}</p>
            <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {group.entries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {LABELS[key] ?? key}
                  </span>
                  <StatusPill status={value} />
                </div>
              ))}
            </div>
          </section>
        ))}

        {ungrouped.length ? (
          <section>
            <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
              Other services
            </h2>
            <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {ungrouped.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {LABELS[key] ?? key}
                  </span>
                  <StatusPill status={value} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <section className="mt-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          What the statuses mean
        </h2>
        <dl className="mt-4 space-y-3">
          {LEGEND.map((item) => (
            <div key={item.status} className="flex flex-wrap items-baseline gap-3">
              <dt className="w-24 shrink-0">
                <StatusPill status={item.status} />
              </dt>
              <dd className="flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {item.meaning}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 border-t border-[var(--line)] pt-4 text-sm leading-relaxed text-[var(--muted)]">
          Pact never blocks on a missing credential — an integration without a
          key falls back to fixtures or mocks so the rest of the flow keeps
          working. A non-live row means that specific data is not real, not
          that the product is down.
        </p>
      </section>
    </div>
  );
}
