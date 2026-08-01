"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PlacesMap } from "@/components/PlacesMap";
import {
  PixelObjectPicker,
  PixelSceneStage,
  usePixelObject,
} from "@/components/pixel/PixelHero";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { PackageComponent, PackageData, Snapshot } from "@/lib/types-client";

const EVENT_ID = "evt_demo_friday";
const TRIP_EVENT_ID = "evt_demo_miami";

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

type RecommendedPlace = {
  id: string;
  label: string;
  query: string;
  type: string;
  cost: number;
  currency: string;
  packages: string[];
};

/** Package component `details` strings are always " · "-joined (see agents/orchestrator.ts) — pull the place name out. */
function placeFromComponent(
  c: PackageComponent,
  destination: string,
): { label: string; query: string } | null {
  const parts = c.details.split(" · ").map((s) => s.trim());
  if (c.type === "ticket") {
    const venue = parts[2] || c.details;
    return { label: venue, query: `${venue}, ${destination}` };
  }
  if (c.type === "dining") {
    const neighborhood = parts[2] || destination;
    return { label: c.vendor, query: `${c.vendor}, ${neighborhood}` };
  }
  if (c.type === "hotel") {
    const name = parts[0] || c.vendor;
    const neighborhood = parts[1] || destination;
    return { label: name, query: `${name}, ${neighborhood}` };
  }
  return null;
}

export function DemoApp({
  googleMapsApiKey,
}: {
  googleMapsApiKey: string | null;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [waPhones, setWaPhones] = useState("");
  const [waReplyPhone, setWaReplyPhone] = useState("+17735411355");
  const [waReplyMsg, setWaReplyMsg] = useState("PLAN");
  const [waNote, setWaNote] = useState<string | null>(null);
  const [eventId, setEventId] = useState(EVENT_ID);
  const [voiceClip, setVoiceClip] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const { active: pixelActive, setActive: setPixelActive } = usePixelObject(true);

  const refresh = useCallback(async () => {
    const data = await j<Snapshot>(`/api/events/${eventId}`);
    setSnap(data);
    return data;
  }, [eventId]);

  useEffect(() => {
    void (async () => {
      try {
        await j("/api/demo/reset", { method: "POST" });
        const [health, data] = await Promise.all([
          j<{ integrations: Record<string, string> }>("/api/health"),
          j<Snapshot>(`/api/events/${eventId}`),
        ]);
        setIntegrations(health.integrations);
        setSnap(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [eventId]);

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
      await j("/api/demo/seed-responses", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
      });
      await j(`/api/events/${eventId}/reconcile`, { method: "POST" });
    });
  }

  async function inviteWhatsApp() {
    const phones = waPhones
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!phones.length) {
      setWaNote("Add at least one +1… number (must be a Meta test recipient).");
      return;
    }
    setBusy(true);
    setError(null);
    setWaNote(null);
    try {
      const res = await j<{
        invited: string[];
        failed?: { phone: string; error: string }[];
        tip?: string;
      }>("/api/channels/whatsapp/invite", {
        method: "POST",
        body: JSON.stringify({ phones }),
      });
      const failBit =
        res.failed?.length ?
          ` Failed: ${res.failed.map((f) => f.phone).join(", ")} (must be Meta-allowed with +1…).`
        : "";
      setWaNote(
        `Invited ${res.invited.length}. They get Meta hello_world first. Ask them to reply “hi” — then AiDHD sends the planning intro (Meta blocks freeform until they reply).${failBit} ${res.tip ?? ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "WhatsApp invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function simulateWhatsAppReply() {
    setBusy(true);
    setError(null);
    setWaNote(null);
    try {
      const res = await j<{ replies: string[] }>(
        "/api/channels/whatsapp/simulate",
        {
          method: "POST",
          body: JSON.stringify({
            phone: waReplyPhone,
            message: waReplyMsg,
          }),
        },
      );
      setWaNote(
        `Bot replied on WhatsApp (${res.replies.length} msg). If phone was quiet, Meta webhook URL may be stale — use this box meanwhile.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(pkg: PackageData) {
    setSelected(pkg.id);
    await run(async () => {
      for (const u of snap?.users ?? []) {
        await j(`/api/events/${eventId}/vote`, {
          method: "POST",
          body: JSON.stringify({ package_id: pkg.id, user_id: u.id }),
        });
      }
      await j(`/api/events/${eventId}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "request", package_id: pkg.id }),
      });
    });
  }

  async function payAndBook() {
    await run(async () => {
      await j(`/api/events/${eventId}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_all" }),
      });
      const bookRes = await j<{
        results?: Array<{ voice?: { audio_url?: string; script?: string } }>;
      }>(`/api/events/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const voice = bookRes.results?.find((r) => r.voice)?.voice;
      if (voice?.audio_url) setVoiceClip(voice.audio_url);
      else if (voice?.script) setWaNote(`Voice script: ${voice.script}`);
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

  const recommendedPlaces = useMemo<RecommendedPlace[]>(() => {
    const destination = snap?.event.destination_or_venue ?? "";
    const byId = new Map<string, RecommendedPlace>();
    for (const pkg of snap?.packages ?? []) {
      for (const c of pkg.components) {
        const derived = placeFromComponent(c, destination);
        if (!derived) continue;
        const id = `${c.type}:${derived.label}`.toLowerCase();
        const existing = byId.get(id);
        if (existing) {
          if (!existing.packages.includes(pkg.label)) {
            existing.packages.push(pkg.label);
          }
          continue;
        }
        byId.set(id, {
          id,
          label: derived.label,
          query: derived.query,
          type: c.type,
          cost: c.cost,
          currency: c.currency,
          packages: [pkg.label],
        });
      }
    }
    return [...byId.values()];
  }, [snap?.packages, snap?.event.destination_or_venue]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 site-atmosphere"
        aria-hidden
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--edge)] bg-[var(--void)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 lg:px-8">
          <button
            type="button"
            onClick={() => scrollTo("top")}
            className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
          >
            AiDHD
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ["problem", "Problem"],
              ["use-cases", "Plans"],
              ["how-it-works", "How it works"],
              ["demo", "Demo"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
              >
                {label}
              </button>
            ))}
            <Link
              href="/agent"
              className="text-sm text-[var(--inksoft)] transition-colors hover:text-[var(--ink)]"
            >
              Live agent
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="btn-primary !py-2 !px-3.5 text-sm"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto w-full max-w-6xl px-5 lg:px-8">
        <section className="grid min-h-[92vh] items-center gap-10 pt-24 pb-16 lg:grid-cols-[0.95fr_1.15fr] lg:gap-10">
          <div className="animate-fade-in order-2 lg:order-1">
            <p className="section-kicker mb-4">Group nights & trips</p>
            <h1 className="font-display text-5xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl lg:text-7xl">
              AiDHD
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--inksoft)]">
              Real accounts, group chat with an in-chat AI agent, encrypted
              traveler vault, and Splitwise-style settle-up — plan to booked.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary">
                Sign in to app
              </Link>
              <Link href="/app" className="btn-ghost">
                Open groups
              </Link>
              <Link href="/agent" className="btn-ghost">
                Live Concierge
              </Link>
              <Link href="/reel" className="btn-ghost">
                Reel → plan
              </Link>
            </div>
            <div className="mt-12">
              <PixelObjectPicker
                active={pixelActive}
                onSelect={setPixelActive}
              />
            </div>
          </div>

          <div className="animate-slide-up order-1 w-full lg:order-2">
            <PixelSceneStage activeKey={pixelActive} journey />
          </div>
        </section>

        <section
          id="problem"
          className="border-t border-[var(--edge)] py-20 md:py-28"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
              Group chat is where plans go to die
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--inksoft)]">
              Three budgets. Two vibes. Zero bookings. AiDHD finishes the loop —
              search, cards, pay, confirm — for nights out and weekend trips.
            </p>
          </div>
        </section>

        <section
          id="use-cases"
          className="border-t border-[var(--edge)] py-20 md:py-28"
        >
          <div className="mb-12 max-w-xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
              Same product. Two kinds of plans.
            </h2>
            <p className="mt-4 text-[var(--inksoft)]">
              Collect → package → pay per category → book.
            </p>
          </div>
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-[var(--inkmute)] uppercase">
                Night out
              </p>
              <h3 className="font-display mt-3 text-2xl font-medium text-[var(--ink)]">
                Concert + dinner
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--inksoft)]">
                Tickets, timing, and a pre-show table that fit everyone&apos;s
                budget — with separate Prava mandates for ticket and dining.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-[var(--inkmute)] uppercase">
                Travel
              </p>
              <h3 className="font-display mt-3 text-2xl font-medium text-[var(--ink)]">
                Weekend / multi-day trip
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--inksoft)]">
                Flights, hotel, itinerary, and dinner — same agent, same
                per-category Prava flow.
              </p>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-t border-[var(--edge)] py-20 md:py-28"
        >
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-[var(--inksoft)]">
            Three steps from messy group chat to a booked night — or trip.
          </p>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Share budget + vibe",
                d: "Web, WhatsApp, or iMessage — dates, caps, and prefs.",
              },
              {
                n: "02",
                t: "Get 2–3 real plans",
                d: "Tickets + dinner, or flights + hotel + itinerary — trust-checked.",
              },
              {
                n: "03",
                t: "Pick. Pay. Book.",
                d: "Separate Prava limits per category. Failures re-ask only that leg.",
              },
            ].map((s) => (
              <div key={s.n}>
                <p className="font-display text-sm text-[var(--inkmute)]">{s.n}</p>
                <h3 className="mt-3 font-display text-xl font-medium text-[var(--ink)]">
                  {s.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--inksoft)]">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="border-t border-[var(--edge)] py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
              Live demo
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--inksoft)]">
              WhatsApp collects prefs. AiDHD plans and books with per-category
              Prava mandates + voice confirm.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEventId(EVENT_ID);
                  setSelected(null);
                  setVoiceClip(null);
                }}
                className={
                  eventId === EVENT_ID ? "btn-primary !py-2" : "btn-ghost !py-2"
                }
              >
                Outing
              </button>
              <button
                type="button"
                onClick={() => {
                  setEventId(TRIP_EVENT_ID);
                  setSelected(null);
                  setVoiceClip(null);
                }}
                className={
                  eventId === TRIP_EVENT_ID
                    ? "btn-primary !py-2"
                    : "btn-ghost !py-2"
                }
              >
                Travel · Miami
              </button>
            </div>
            {error && (
              <p className="mt-6 border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>

          {integrations.whatsapp === "live" && (
            <div className="surface mx-auto mt-8 max-w-3xl px-5 py-5">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                WhatsApp sandbox
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--inksoft)]">
                <li>
                  Meta → app <strong className="text-[var(--ink)]">AiDHD</strong>{" "}
                  → <strong className="text-[var(--ink)]">Use cases</strong>
                </li>
                <li>
                  Open{" "}
                  <strong className="text-[var(--ink)]">
                    Connect with customers through WhatsApp
                  </strong>
                </li>
                <li>
                  Add recipient numbers, then paste them below → Text friends
                </li>
              </ol>
              <textarea
                value={waPhones}
                onChange={(e) => setWaPhones(e.target.value)}
                placeholder="+15551234567, +15559876543"
                rows={2}
                className="mt-4 w-full border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--edgehot)]"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void inviteWhatsApp()}
                className="btn-primary mt-3 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Text friends"}
              </button>
              <div className="mt-5 border-t border-[var(--edge)] pt-4">
                <p className="text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                  Research call
                </p>
                <p className="mt-1 text-sm text-[var(--inksoft)]">
                  Demo a venue research call (height limits, hotel policy…).
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const res = await j<{
                          job: { id: string; findings?: string; status: string };
                        }>("/api/agents/research-call", {
                          method: "POST",
                          body: JSON.stringify({
                            venue_name: "Miami Go-Karts",
                            venue_phone: "+13055550100",
                            question: "What's the height limit for drivers?",
                            reply_to_phone: waReplyPhone,
                            simulate: true,
                          }),
                        });
                        setWaNote(
                          `Research ${res.job.status}: ${res.job.findings ?? res.job.id}`,
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Research failed",
                        );
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                  className="btn-ghost mt-3 disabled:opacity-50"
                >
                  Demo research call
                </button>
              </div>
              <div className="mt-5 border-t border-[var(--edge)] pt-4">
                <p className="text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                  Simulate reply
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={waReplyPhone}
                    onChange={(e) => setWaReplyPhone(e.target.value)}
                    placeholder="+17735411355"
                    className="border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none focus:border-[var(--edgehot)] sm:w-44"
                  />
                  <input
                    value={waReplyMsg}
                    onChange={(e) => setWaReplyMsg(e.target.value)}
                    placeholder="PLAN"
                    className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none focus:border-[var(--edgehot)]"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void simulateWhatsAppReply()}
                    className="btn-ghost disabled:opacity-50"
                  >
                    Send reply
                  </button>
                </div>
              </div>
              {waNote && (
                <p className="mt-3 text-sm text-[var(--inksoft)]">{waNote}</p>
              )}
            </div>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--edge)] px-4 py-3">
                <span className="text-sm text-[var(--inkmute)]">
                  {snap?.event.title ?? "loading…"}
                </span>
              </div>

              <div className="space-y-6 p-5 sm:p-6">
                {phase === "idle" && (
                  <div className="py-8 text-center">
                    <p className="text-[var(--inksoft)]">
                      Load the demo group, then watch plans appear.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void startDemo()}
                      className="btn-primary mt-6 disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Start demo"}
                    </button>
                  </div>
                )}

                {(phase === "group" ||
                  phase === "plans" ||
                  phase === "pay" ||
                  phase === "done") && (
                  <div>
                    <p className="mb-3 text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
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
                            className="border border-[var(--edge)] bg-[var(--void)]/40 px-3 py-3"
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-sm font-medium text-[var(--ink)]">
                                {name}
                              </span>
                              <span className="text-sm text-[var(--inksoft)]">
                                ${r.budget_cap}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--inkmute)]">
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
                    <p className="mb-3 text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                      {phase === "plans" ? "Pick a plan" : "Selected plan"}
                    </p>
                    <div className="space-y-3">
                      {(phase === "plans"
                        ? (snap?.packages ?? [])
                        : chosen
                          ? [chosen]
                          : []
                      ).map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          disabled={busy || phase !== "plans"}
                          onClick={() => void choosePlan(pkg)}
                          className={`w-full border p-4 text-left transition ${
                            chosen?.id === pkg.id
                              ? "border-white/30 bg-white/[0.04]"
                              : "border-[var(--edge)] bg-transparent hover:border-[var(--edgehot)]"
                          } disabled:cursor-default`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display text-base font-medium text-[var(--ink)]">
                                {pkg.label}
                              </div>
                              <p className="mt-1 text-xs text-[var(--inkmute)]">
                                {snap?.event?.proposed_dates?.length
                                  ? `Event window: ${snap.event.proposed_dates.join(" → ")}`
                                  : null}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm text-[var(--inksoft)]">
                                {pkg.rationale}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {pkg.components.map((c, i) => (
                                  <span
                                    key={i}
                                    className="border border-[var(--edge)] px-2 py-0.5 text-[11px] text-[var(--inkmute)]"
                                  >
                                    {c.vendor}
                                    {c.vendor_verified ? " · Senso" : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="font-medium text-[var(--ink)]">
                                ${pkg.total_cost}
                              </div>
                              <div className="text-xs text-[var(--inkmute)]">
                                ${pkg.cost_per_person}/person
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {phase === "plans" && (
                      <p className="mt-3 text-center text-xs text-[var(--inkmute)]">
                        Tap a plan to request Prava payment limits
                      </p>
                    )}
                  </div>
                )}

                {(phase === "pay" || phase === "done") && (
                  <div>
                    <p className="mb-3 text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                      Pay with Prava
                    </p>
                    <div className="space-y-2">
                      {(snap?.mandates ?? []).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between border border-[var(--edge)] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-medium capitalize text-[var(--ink)]">
                              {m.category}
                              <span className="font-normal text-[var(--inkmute)]">
                                {" "}
                                · {m.merchant}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--inkmute)]">
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
                        className="btn-primary mt-5 w-full disabled:opacity-50"
                      >
                        {busy ? "Booking…" : "Approve & book"}
                      </button>
                    )}
                  </div>
                )}

                {phase === "done" && (
                  <div className="border border-[var(--edge)] bg-white/[0.03] p-4 text-center">
                    <p className="font-display text-lg font-medium text-[var(--ink)]">
                      Booked
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-[var(--inksoft)]">
                      {(snap?.bookings ?? [])
                        .filter((b) => b.status === "confirmed")
                        .map((b) => (
                          <p key={b.id}>
                            <span className="capitalize">{b.category}</span>:{" "}
                            {b.confirmation_id}
                          </p>
                        ))}
                    </div>
                    {voiceClip && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs tracking-[0.12em] text-[var(--inkmute)] uppercase">
                          Voice confirm
                        </p>
                        <audio
                          controls
                          src={voiceClip}
                          className="mx-auto w-full max-w-sm"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void resetDemo()}
                      className="mt-5 text-sm text-[var(--inksoft)] underline-offset-4 hover:underline"
                    >
                      Run again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {recommendedPlaces.length > 0 && (
              <div className="flex flex-col gap-6">
                <div className="surface p-4">
                  <p className="mb-3 text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                    Recommended places
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {recommendedPlaces.map((p) => (
                      <div
                        key={p.id}
                        onMouseEnter={() => setHoveredPlaceId(p.id)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) => (id === p.id ? null : id))
                        }
                        className={`cursor-default border px-3 py-2 transition ${
                          hoveredPlaceId === p.id
                            ? "border-white/25 bg-white/[0.04]"
                            : "border-[var(--edge)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[var(--ink)]">
                            {p.label}
                          </span>
                          <span className="text-xs text-[var(--inksoft)]">
                            ${p.cost}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[var(--inkmute)]">
                          <span className="capitalize">{p.type}</span> ·{" "}
                          {p.packages.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <PlacesMap
                  apiKey={googleMapsApiKey}
                  places={recommendedPlaces}
                  hoveredId={hoveredPlaceId}
                />
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-[var(--edge)] py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-base font-semibold text-[var(--ink)]">
                AiDHD
              </p>
              <p className="mt-1 text-sm text-[var(--inkmute)]">
                Built for Prava&apos;s Agentic Commerce Hackathon
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(integrations).map(([k, v]) => (
                <span
                  key={k}
                  className={`border px-2.5 py-1 text-[10px] tracking-wide uppercase ${
                    v === "live" || v === "registered"
                      ? "border-white/25 text-[var(--inksoft)]"
                      : "border-[var(--edge)] text-[var(--inkmute)]"
                  }`}
                >
                  {k} {v}
                </span>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const ok =
    status === "approved" || status === "used" || status === "confirmed";
  return (
    <span
      className={`border px-2.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
        ok
          ? "border-white/25 text-[var(--inksoft)]"
          : status === "failed"
            ? "border-red-400/40 text-red-200"
            : "border-[var(--edge)] text-[var(--inkmute)]"
      }`}
    >
      {status}
    </span>
  );
}
