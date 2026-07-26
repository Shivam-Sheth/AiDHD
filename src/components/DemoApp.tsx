"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  CollectorSession,
  Snapshot,
} from "@/lib/types-client";

const EVENT_ID = "evt_demo_friday";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const STEPS = [
  "Collect",
  "Reconcile",
  "Vote",
  "Mandates",
  "Book",
  "Confirm",
] as const;

function statusStep(status: string): number {
  switch (status) {
    case "collecting":
      return 0;
    case "reconciling":
      return 1;
    case "voting":
      return 2;
    case "paying":
      return 3;
    case "booking":
      return 4;
    case "confirmed":
      return 5;
    default:
      return 0;
  }
}

export function DemoApp() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [activeUser, setActiveUser] = useState("user_maya");
  const [session, setSession] = useState<CollectorSession | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [waPreview, setWaPreview] = useState<
    { from: string; text: string; buttons?: string[] }[]
  >([]);
  const [imPreview, setImPreview] = useState<
    { from: string; text: string }[]
  >([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function refresh() {
    const data = await j<Snapshot>(`/api/events/${EVENT_ID}`);
    setSnap(data);
    return data;
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        await j("/api/demo/reset", { method: "POST" });
        const [health, snapData, wa, im, chat] = await Promise.all([
          j<{ integrations: Record<string, string> }>("/api/health"),
          j<Snapshot>(`/api/events/${EVENT_ID}`),
          j<{ transcript: { from: string; text: string; buttons?: string[] }[] }>(
            "/api/channels/whatsapp/preview",
          ),
          j<{ transcript: { from: string; text: string }[] }>(
            "/api/channels/imessage/preview",
          ),
          j<{ session: CollectorSession }>(
            `/api/events/${EVENT_ID}/chat?user_id=user_maya`,
          ),
        ]);
        setIntegrations(health.integrations);
        setSnap(snapData);
        setWaPreview(wa.transcript);
        setImPreview(im.transcript);
        setSession(chat.session);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load demo");
      }
    });
  }, []);

  useEffect(() => {
    if (!snap) return;
    j<{ session: CollectorSession }>(
      `/api/events/${EVENT_ID}/chat?user_id=${activeUser}`,
    )
      .then((r) => setSession(r.session))
      .catch(() => undefined);
  }, [activeUser, snap?.event.status]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(null);
    }
  }

  async function seedResponses() {
    await run("Seeding group…", async () => {
      await j("/api/demo/seed-responses", { method: "POST" });
      setNote("3 fixture responses loaded (Maya / Jordan / Sam).");
    });
  }

  async function reconcile() {
    await run("Reconciling…", async () => {
      const result = await j<{
        envelope: number;
        conflicts: string[];
        packages: unknown[];
      }>(`/api/events/${EVENT_ID}/reconcile`, { method: "POST" });
      setNote(
        `Envelope $${result.envelope}. Conflicts: ${result.conflicts.join(" · ") || "none"}.`,
      );
    });
  }

  async function vote(packageId: string) {
    await run("Recording vote…", async () => {
      await j(`/api/events/${EVENT_ID}/vote`, {
        method: "POST",
        body: JSON.stringify({ package_id: packageId, user_id: activeUser }),
      });
    });
  }

  async function selectAndMandate(packageId: string) {
    await run("Requesting Prava mandates…", async () => {
      for (const u of snap?.users ?? []) {
        await j(`/api/events/${EVENT_ID}/vote`, {
          method: "POST",
          body: JSON.stringify({ package_id: packageId, user_id: u.id }),
        });
      }
      await j(`/api/events/${EVENT_ID}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "request", package_id: packageId }),
      });
      setNote(
        "Separate Prava mandate per category (ticket + dining) — not one lump sum.",
      );
    });
  }

  async function approveAll() {
    await run("Approving mandates…", async () => {
      await j(`/api/events/${EVENT_ID}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_all" }),
      });
      setNote("Passkey-approved (simulated). Each category still scoped independently.");
    });
  }

  async function book(failTicket = false) {
    await run(failTicket ? "Booking (ticket fail)…" : "Booking…", async () => {
      const result = await j<{
        event: { status: string };
        bookings: { status: string; failure_reason?: string }[];
      }>(`/api/events/${EVENT_ID}/book`, {
        method: "POST",
        body: JSON.stringify({ fail_ticket: failTicket }),
      });
      if (failTicket) {
        setNote(
          "Ticket sold out — only the ticket mandate failed. Dining mandate untouched.",
        );
      } else if (result.event.status === "confirmed") {
        setNote("Booked end-to-end. Confirmations fanned out to group channels.");
      }
    });
  }

  async function rerequest() {
    await run("Re-requesting failed mandate…", async () => {
      await j(`/api/events/${EVENT_ID}/book`, {
        method: "POST",
        body: JSON.stringify({ action: "rerequest_failed" }),
      });
      setNote("Re-requested only the failed category mandate.");
    });
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput("");
    await run("Sending…", async () => {
      const result = await j<{ session: CollectorSession; allIn: boolean }>(
        `/api/events/${EVENT_ID}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: activeUser, message: text }),
        },
      );
      setSession(result.session);
      if (result.allIn) setNote("Everyone responded — ready to reconcile.");
    });
  }

  const step = statusStep(snap?.event.status ?? "collecting");

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-20 pt-8 sm:px-8">
      <header className="anim-rise flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="display text-5xl font-extrabold tracking-tight sm:text-6xl">
              <span className="brand-gradient">AiDHD</span>
            </p>
            <p className="mt-2 max-w-xl text-lg text-[var(--muted)]">
              The group-chat planner that actually books — budgets in, packages
              out, per-category Prava mandates, done.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)] backdrop-blur">
            <div className="font-semibold text-[var(--ink)]">
              Agentic Commerce Hackathon
            </div>
            <div>Prava · OpenAI · Visa · Senso · Linq · NANDA</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                i === step
                  ? "anim-pulse bg-[var(--accent)] text-white"
                  : i < step
                    ? "bg-[var(--ink)] text-white/90"
                    : "bg-white/60 text-[var(--muted)]"
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionBtn
            onClick={seedResponses}
            busy={busy}
            label="1 · Seed demo group"
          />
          <ActionBtn
            onClick={reconcile}
            busy={busy}
            label="2 · Generate packages"
          />
          <ActionBtn
            onClick={() =>
              snap?.packages[1]
                ? selectAndMandate(snap.packages[1].id)
                : Promise.resolve()
            }
            busy={busy}
            label="3 · Pick Best match + mandates"
            disabled={!snap?.packages.length}
          />
          <ActionBtn
            onClick={approveAll}
            busy={busy}
            label="4 · Approve mandates"
            disabled={!snap?.mandates.some((m) => m.status === "requested")}
          />
          <ActionBtn
            onClick={() => book(true)}
            busy={busy}
            label="5 · Book (fail ticket)"
            disabled={!snap?.mandates.some((m) => m.status === "approved")}
          />
          <ActionBtn
            onClick={rerequest}
            busy={busy}
            label="6 · Re-mandate ticket"
            disabled={!snap?.mandates.some((m) => m.status === "failed")}
          />
          <ActionBtn
            onClick={async () => {
              await approveAll();
              await book(false);
            }}
            busy={busy}
            label="7 · Finish booking"
            disabled={
              !snap?.mandates.some(
                (m) => m.status === "approved" || m.status === "requested",
              )
            }
          />
          <ActionBtn
            onClick={() =>
              run("Resetting…", async () => {
                await j("/api/demo/reset", { method: "POST" });
                setNote("Demo reset.");
              })
            }
            busy={busy}
            label="Reset"
            tone="ghost"
          />
        </div>

        {(note || error || busy) && (
          <div
            className={`anim-rise rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-[var(--line)] bg-white/70 text-[var(--ink)]"
            }`}
          >
            {error || busy || note}
          </div>
        )}
      </header>

      <section className="anim-rise-delay-1 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Event" subtitle={snap?.event.title ?? "Loading…"}>
          {snap && (
            <div className="space-y-3 text-sm">
              <Row k="Venue" v={snap.event.destination_or_venue} />
              <Row k="Dates" v={snap.event.proposed_dates.join(" · ")} />
              <Row k="Status" v={snap.event.status} />
              <Row
                k="Group"
                v={snap.users.map((u) => `${u.name} (${u.channel})`).join(" · ")}
              />
              <div className="pt-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Responses ({snap.responses.length}/3)
                </div>
                <div className="space-y-2">
                  {snap.responses.map((r) => {
                    const user = snap.users.find((u) => u.id === r.user_id);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-[var(--line)] bg-white/50 px-3 py-2"
                      >
                        <div className="font-semibold">
                          {user?.name} · ${r.budget_cap} · {r.channel}
                        </div>
                        <div className="text-[var(--muted)]">
                          {r.preferences.free_text}
                        </div>
                      </div>
                    );
                  })}
                  {!snap.responses.length && (
                    <p className="text-[var(--muted)]">
                      No responses yet — seed the demo group or chat below.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Web collector" subtitle="Same Response schema as WA / iMessage">
          <div className="mb-3 flex flex-wrap gap-2">
            {snap?.users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setActiveUser(u.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeUser === u.id
                    ? "bg-[var(--ink)] text-white"
                    : "bg-white/70 text-[var(--muted)]"
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-deep)] p-3 text-sm text-teal-50">
            {session?.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 ${
                  m.role === "assistant"
                    ? "bg-teal-900/80"
                    : "ml-auto bg-[var(--coral)]"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Reply as selected person…"
              className="flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
            <button
              type="button"
              onClick={sendChat}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Send
            </button>
          </div>
        </Panel>
      </section>

      <section className="anim-rise-delay-2">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl font-bold">Packages</h2>
            <p className="text-sm text-[var(--muted)]">
              Distinct trade-offs · Senso trust badges on every merchant
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(snap?.packages ?? []).map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] backdrop-blur transition hover:-translate-y-0.5"
            >
              <div className="display text-xl font-bold">{pkg.label}</div>
              <p className="mt-1 text-sm text-[var(--muted)]">{pkg.rationale}</p>
              <div className="mt-3 text-2xl font-bold">
                ${pkg.total_cost}
                <span className="ml-2 text-sm font-medium text-[var(--muted)]">
                  (${pkg.cost_per_person}/person)
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Fit {(pkg.fit_score * 100).toFixed(0)}% · {pkg.votes.length} vote
                {pkg.votes.length === 1 ? "" : "s"}
              </div>
              <ul className="mt-3 flex-1 space-y-2">
                {pkg.components.map((c, i) => (
                  <li
                    key={`${pkg.id}-${i}`}
                    className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">
                        {c.type} · {c.vendor}
                      </span>
                      <span>${c.cost}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{c.details}</div>
                    {c.vendor_verified && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                        Verified via Senso ·{" "}
                        {(c.vendor_trust_score * 100).toFixed(0)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => vote(pkg.id)}
                  className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold"
                >
                  Vote as {snap?.users.find((u) => u.id === activeUser)?.name}
                </button>
                <button
                  type="button"
                  onClick={() => selectAndMandate(pkg.id)}
                  className="flex-1 rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white"
                >
                  Select + mandates
                </button>
              </div>
            </article>
          ))}
          {!snap?.packages.length && (
            <p className="text-sm text-[var(--muted)] md:col-span-3">
              Generate packages after seeding responses.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Prava mandates"
          subtitle="One scoped mandate per cost category — resilient to partial failure"
        >
          {!snap?.mandates.length && (
            <p className="text-sm text-[var(--muted)]">
              Select a package to request ticket + dining mandates separately.
            </p>
          )}
          <div className="space-y-2">
            {snap?.mandates.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize">
                    {m.category} → {m.merchant}
                  </span>
                  <StatusPill status={m.status} />
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Cap ${m.amount_cap} · {m.duration_minutes}m ·{" "}
                  {m.prava_mandate_id}
                </div>
              </div>
            ))}
          </div>
          {!!snap?.bookings.length && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Bookings
              </div>
              {snap.bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-2 text-sm"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold capitalize">{b.category}</span>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {b.confirmation_id || b.failure_reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Agent log" subtitle="Tool calls the judges can narrate">
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(snap?.agent_logs ?? []).length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Logs appear when you reconcile / mandate / book.
              </p>
            )}
            {snap?.agent_logs.map((log, i) => (
              <div
                key={`${log.at}-${i}`}
                className="rounded-lg border border-[var(--line)] bg-white/50 px-3 py-2 text-xs"
              >
                <span className="font-bold text-[var(--accent)]">{log.step}</span>
                <span className="text-[var(--muted)]"> — {log.detail}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="WhatsApp collector" subtitle="Llama 3 task-scoped · Meta Cloud API">
          <Transcript rows={waPreview} />
        </Panel>
        <Panel title="iMessage collector" subtitle="Linq API · group chat ready">
          <Transcript rows={imPreview} />
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Integrations" subtitle="Mock until keys are present">
          <div className="flex flex-wrap gap-2">
            {Object.entries(integrations).map(([k, v]) => (
              <span
                key={k}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  v === "live" || v === "registered"
                    ? "bg-teal-100 text-teal-900"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {k}: {v}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Set keys in <code>.env.local</code> — see README. Prava is the
            non-negotiable live path for submission.
          </p>
        </Panel>
        <Panel title="NANDA AgentFacts" subtitle="Project NANDA registry card">
          <a
            href="/api/nanda/agent-card"
            className="text-sm font-semibold text-[var(--accent)] underline"
            target="_blank"
            rel="noreferrer"
          >
            View agent card JSON →
          </a>
          <p className="mt-2 text-xs text-[var(--muted)]">
            A2A endpoint: <code>POST /api/nanda/a2a</code> with{" "}
            <code>{`{ "method": "trust.ping" }`}</code>
          </p>
        </Panel>
      </section>

      <footer className="border-t border-[var(--line)] pt-6 text-xs text-[var(--muted)]">
        AiDHD · built for{" "}
        <a
          className="underline"
          href="https://agentic-commerce.devfolio.co/"
          target="_blank"
          rel="noreferrer"
        >
          Prava&apos;s Agentic Commerce Hackathon
        </a>{" "}
        · Visa Trusted Agent Protocol via Prava mandates · trip mode stubbed
      </footer>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
      <h3 className="display text-lg font-bold">{title}</h3>
      {subtitle && (
        <p className="mb-3 text-xs text-[var(--muted)]">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] py-1">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "confirmed" || status === "approved" || status === "used"
      ? "bg-teal-100 text-teal-900"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-900";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  busy,
  disabled,
  tone = "solid",
}: {
  label: string;
  onClick: () => void | Promise<void>;
  busy: string | null;
  disabled?: boolean;
  tone?: "solid" | "ghost";
}) {
  return (
    <button
      type="button"
      disabled={Boolean(busy) || disabled}
      onClick={() => void onClick()}
      className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
        tone === "ghost"
          ? "border border-[var(--line)] bg-white/50 text-[var(--muted)]"
          : "bg-[var(--accent)] text-white hover:bg-[var(--accent-bright)]"
      }`}
    >
      {label}
    </button>
  );
}

function Transcript({
  rows,
}: {
  rows: { from: string; text: string; buttons?: string[] }[];
}) {
  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl bg-[var(--bg-deep)] p-3 text-sm">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`max-w-[92%] rounded-2xl px-3 py-2 ${
            row.from === "bot"
              ? "bg-teal-900/80 text-teal-50"
              : "ml-auto bg-[var(--coral)] text-white"
          }`}
        >
          <div>{row.text}</div>
          {row.buttons && (
            <div className="mt-2 flex flex-wrap gap-1">
              {row.buttons.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
