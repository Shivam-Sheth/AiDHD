"use client";

import { useCallback, useEffect, useState } from "react";
import type { PackageData, Snapshot } from "@/lib/types-client";

const EVENT_ID = "evt_demo_friday";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

type Phase = "idle" | "group" | "plans" | "pay" | "done";

function phaseFrom(snap: Snapshot | null): Phase {
  if (!snap) return "idle";
  if (snap.event.status === "confirmed") return "done";
  if (snap.mandates.length) return "pay";
  if (snap.packages.length) return "plans";
  if (snap.responses.length) return "group";
  return "idle";
}

export function DemoApp() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await j<Snapshot>(`/api/events/${EVENT_ID}`);
    setSnap(data);
    return data;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await j("/api/demo/reset", { method: "POST" });
        const [health, data] = await Promise.all([
          j<{ integrations: Record<string, string> }>("/api/health"),
          j<Snapshot>(`/api/events/${EVENT_ID}`),
        ]);
        setIntegrations(health.integrations);
        setSnap(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  const phase = phaseFrom(snap);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(false);
    }
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  async function startDemo() {
    scrollTo("demo");
    await run(async () => {
      await j("/api/demo/seed-responses", { method: "POST" });
      await j(`/api/events/${EVENT_ID}/reconcile`, { method: "POST" });
    });
  }

  async function choosePlan(pkg: PackageData) {
    setSelected(pkg.id);
    await run(async () => {
      for (const u of snap?.users ?? []) {
        await j(`/api/events/${EVENT_ID}/vote`, {
          method: "POST",
          body: JSON.stringify({ package_id: pkg.id, user_id: u.id }),
        });
      }
      await j(`/api/events/${EVENT_ID}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "request", package_id: pkg.id }),
      });
    });
  }

  async function payAndBook() {
    await run(async () => {
      await j(`/api/events/${EVENT_ID}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_all" }),
      });
      await j(`/api/events/${EVENT_ID}/book`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });
  }

  async function resetDemo() {
    setSelected(null);
    await run(async () => {
      await j("/api/demo/reset", { method: "POST" });
    });
  }

  const chosen =
    snap?.packages.find(
      (p) => p.id === selected || p.id === snap.event.selected_package_id,
    ) ?? null;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
          <button
            type="button"
            onClick={() => scrollTo("top")}
            className="font-display text-xl font-bold text-neutral-900 transition-colors hover:text-[var(--accent)]"
          >
            AiDHD
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["problem", "Problem"],
              ["how-it-works", "How it works"],
              ["demo", "Demo"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className="text-sm font-medium text-neutral-600 transition-colors hover:text-[var(--accent)]"
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => void startDemo()}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-shadow)] transition hover:bg-[var(--accent-hover)]"
          >
            Try demo
          </button>
        </div>
      </header>

      {/* Hero */}
      <section
        id="top"
        className="relative flex min-h-[88vh] items-center overflow-hidden bg-neutral-50 bg-grid-pattern"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-50/50 via-transparent to-transparent" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 py-16 lg:flex-row lg:gap-16 lg:px-10 lg:py-24">
          <div className="animate-fade-in flex-1 text-center lg:text-left">
            <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
              AiDHD
            </h1>
            <p className="mt-4 text-xl font-semibold text-[var(--accent)] sm:text-2xl">
              Concierge for group plans
            </p>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 lg:mx-0">
              Your friends drop budgets and vibes in the chat. AiDHD builds a
              few costed options, you pick one, and it books — paying with a
              separate Prava limit for tickets and dinner, not one scary lump
              sum.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4 lg:justify-start">
              <button
                type="button"
                onClick={() => void startDemo()}
                className="rounded-xl bg-[var(--accent)] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[var(--accent-shadow)] transition hover:bg-[var(--accent-hover)]"
              >
                Try demo
              </button>
              <button
                type="button"
                onClick={() => scrollTo("how-it-works")}
                className="rounded-xl border-2 border-neutral-300 px-6 py-3.5 font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-teal-50/50 hover:text-[var(--accent)]"
              >
                How it works
              </button>
            </div>
          </div>

          <div className="animate-slide-up w-full max-w-lg flex-1">
            <HeroCard />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="border-t border-neutral-200 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <h2 className="font-display text-3xl font-bold text-neutral-900 sm:text-4xl">
            Group chat is where nights go to die
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Three budgets. Two vibes. Zero bookings. Someone spends an hour
            reconciling Ticketmaster tabs and OpenTable holds — then the plan
            falls apart. AiDHD is the agent that finishes the job.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="bg-neutral-50 bg-grid-pattern py-20 lg:py-28"
      >
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <h2 className="font-display text-center text-3xl font-bold text-neutral-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-neutral-600">
            Three steps from messy group chat to confirmed night out.
          </p>
          <div className="relative mt-16">
            <div
              className="absolute top-8 right-0 left-0 hidden h-0.5 bg-neutral-200 lg:block"
              style={{ marginLeft: "12.5%", marginRight: "12.5%", width: "75%" }}
            />
            <div className="grid gap-10 md:grid-cols-3 lg:gap-6">
              {[
                {
                  n: "1",
                  t: "Everyone shares a budget + vibe",
                  d: "Web, WhatsApp, or iMessage — same simple questions. No accounts to set up for the demo.",
                },
                {
                  n: "2",
                  t: "AiDHD builds 2–3 real plans",
                  d: "Tickets + dinner, priced for the group, with merchant trust checks. Distinct options — not three clones.",
                },
                {
                  n: "3",
                  t: "You pick. It pays & books.",
                  d: "Separate Prava spend limits per category. If tickets sell out, only that limit is re-asked.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] font-display text-2xl font-bold text-white shadow-lg shadow-[var(--accent-shadow)]">
                    {s.n}
                  </div>
                  <h3 className="mt-6 font-display text-xl font-semibold text-neutral-900">
                    {s.t}
                  </h3>
                  <p className="mt-2 max-w-xs text-neutral-600">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="border-t border-neutral-200 bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <h2 className="font-display text-center text-3xl font-bold text-neutral-900 sm:text-4xl">
            Live demo
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-neutral-600">
            Friday night out — concert + dinner for three friends.
          </p>

          {error && (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/50">
            <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="ml-2 text-sm font-medium text-neutral-500">
                AiDHD — {snap?.event.title ?? "loading…"}
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {phase === "idle" && (
                <div className="py-8 text-center">
                  <p className="text-neutral-600">
                    Load the demo group, then watch plans appear.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startDemo()}
                    className="mt-6 rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white shadow-lg shadow-[var(--accent-shadow)] disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Start demo"}
                  </button>
                </div>
              )}

              {(phase === "group" || phase === "plans" || phase === "pay" || phase === "done") && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                    The group
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(snap?.responses ?? []).map((r) => {
                      const name =
                        snap?.users.find((u) => u.id === r.user_id)?.name ??
                        "Friend";
                      return (
                        <div
                          key={r.id}
                          className="rounded-xl bg-neutral-100 px-3 py-3"
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="font-semibold text-neutral-900">
                              {name}
                            </span>
                            <span className="text-sm font-semibold text-[var(--accent)]">
                              ${r.budget_cap}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                            {r.preferences.free_text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(phase === "plans" || phase === "pay" || phase === "done") && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                    {phase === "plans" ? "Pick a plan" : "Selected plan"}
                  </p>
                  <div className="space-y-3">
                    {(phase === "plans"
                      ? snap?.packages ?? []
                      : chosen
                        ? [chosen]
                        : []
                    ).map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        disabled={busy || phase !== "plans"}
                        onClick={() => void choosePlan(pkg)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          chosen?.id === pkg.id
                            ? "border-[var(--accent)] bg-teal-50 glow-accent"
                            : "border-neutral-200 bg-neutral-50 hover:border-[var(--accent)]/40"
                        } disabled:cursor-default`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display font-semibold text-neutral-900">
                              {pkg.label}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                              {pkg.rationale}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pkg.components.map((c, i) => (
                                <span
                                  key={i}
                                  className="rounded-md bg-white px-2 py-0.5 text-[11px] text-neutral-600"
                                >
                                  {c.vendor}
                                  {c.vendor_verified ? " · Senso" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-neutral-900">
                              ${pkg.total_cost}
                            </div>
                            <div className="text-xs text-neutral-500">
                              ${pkg.cost_per_person}/person
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {phase === "plans" && (
                    <p className="mt-3 text-center text-xs text-neutral-500">
                      Tap a plan to request Prava payment limits
                    </p>
                  )}
                </div>
              )}

              {(phase === "pay" || phase === "done") && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                    Pay with Prava — one limit per category
                  </p>
                  <div className="space-y-2">
                    {(snap?.mandates ?? []).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold capitalize text-neutral-900">
                            {m.category}
                            <span className="font-normal text-neutral-500">
                              {" "}
                              · {m.merchant}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            Cap ${m.amount_cap}
                          </div>
                        </div>
                        <StatusDot status={m.status} />
                      </div>
                    ))}
                  </div>

                  {phase === "pay" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void payAndBook()}
                      className="mt-5 w-full rounded-xl bg-[var(--accent)] py-3.5 font-semibold text-white shadow-lg shadow-[var(--accent-shadow)] disabled:opacity-50"
                    >
                      {busy ? "Booking…" : "Approve & book"}
                    </button>
                  )}
                </div>
              )}

              {phase === "done" && (
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-center">
                  <p className="font-display text-lg font-semibold text-neutral-900">
                    Booked
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-neutral-600">
                    {(snap?.bookings ?? [])
                      .filter((b) => b.status === "confirmed")
                      .map((b) => (
                        <p key={b.id}>
                          <span className="capitalize">{b.category}</span>:{" "}
                          {b.confirmation_id}
                        </p>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void resetDemo()}
                    className="mt-5 text-sm font-semibold text-[var(--accent)]"
                  >
                    Run again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="font-display font-bold text-neutral-900">AiDHD</p>
            <p className="mt-1 text-sm text-neutral-500">
              Built for Prava&apos;s Agentic Commerce Hackathon
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(integrations).map(([k, v]) => (
              <span
                key={k}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${
                  v === "live" || v === "registered"
                    ? "bg-teal-50 text-[var(--accent)]"
                    : "bg-neutral-200/70 text-neutral-500"
                }`}
              >
                {k} {v}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/50">
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-red-400" />
        <div className="h-2 w-2 rounded-full bg-amber-400" />
        <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
        <span className="ml-2 text-sm font-medium text-neutral-500">
          Group night — AiDHD
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-xl bg-neutral-100 p-3">
          <p className="mb-1 text-xs font-medium tracking-wider text-neutral-500 uppercase">
            Group chat
          </p>
          <p className="text-sm text-neutral-700">
            Maya $150 · Jordan $100 · Sam $200 — Brooklyn, seats vs standing,
            vegetarian dinner…
          </p>
        </div>
        <div className="flex justify-center">
          <span className="text-sm font-semibold text-[var(--accent)]">
            ↓ AiDHD plans
          </span>
        </div>
        <div className="glow-accent rounded-xl border border-teal-100 bg-teal-50 p-3">
          <p className="mb-1 text-xs font-medium tracking-wider text-teal-800 uppercase">
            Best match
          </p>
          <p className="text-sm text-neutral-800">
            Brooklyn Steel GA + Lilia — $348 total · trust-checked merchants
          </p>
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">
            Then: ticket mandate + dining mandate → booked
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const ok =
    status === "approved" || status === "used" || status === "confirmed";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
        ok
          ? "bg-teal-100 text-teal-800"
          : status === "failed"
            ? "bg-red-100 text-red-700"
            : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {status}
    </span>
  );
}
