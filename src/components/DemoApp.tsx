"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlacesMap } from "@/components/PlacesMap";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TripsOutings } from "@/components/landing/TripsOutings";
import { FooterCTA } from "@/components/landing/FooterCTA";
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
  // Flights are a route, not a point on a map — skip.
  return null;
}

export function DemoApp({
  googleMapsApiKey,
}: {
  googleMapsApiKey: string | null;
}) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
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

  const refresh = useCallback(async () => {
    const data = await j<Snapshot>(`/api/events/${eventId}`);
    setSnap(data);
    return data;
  }, [eventId]);

  useEffect(() => {
    void (async () => {
      try {
        const health = await j<{ integrations: Record<string, string> }>(
          "/api/health",
        );
        setIntegrations(health.integrations);
      } catch (e) {
        setHealthError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setHealthLoaded(true);
      }
    })();
  }, []);

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

  /** Bypass Meta webhook — types a reply as if it came from WhatsApp. */
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
    <div className="min-h-screen bg-neutral-50">
      <SiteHeader
        busy={busy}
        onScrollTo={scrollTo}
        onStartPlanning={() => router.push("/agent")}
      />

      <Hero
        busy={busy}
        error={error}
        onStartPlanning={() => router.push("/agent")}
        onSeeHowItWorks={() => scrollTo("how-it-works")}
      />

      <HowItWorks />

<TripsOutings />

      <FooterCTA
        busy={busy}
        onStartPlanning={() => router.push("/agent")}
        onScrollTo={scrollTo}
        integrations={integrations}
        healthLoaded={healthLoaded}
        healthError={healthError}
      />

      {/* Demo */}
      {/* <section id="demo" className="border-t border-neutral-200 bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-center text-3xl font-bold text-ink sm:text-4xl">
            Live demo
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted">
            WhatsApp collects prefs only. AiDHD&apos;s agent subnet plans +
            books (outing or trip) with per-category Prava mandates + voice
            confirm.
          </p>

          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEventId(EVENT_ID);
                setSelected(null);
                setVoiceClip(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                eventId === EVENT_ID
                  ? "bg-ink text-inverse"
                  : "bg-subtle text-ink-700"
              }`}
            >
              Outing demo
            </button>
            <button
              type="button"
              onClick={() => {
                setEventId(TRIP_EVENT_ID);
                setSelected(null);
                setVoiceClip(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                eventId === TRIP_EVENT_ID
                  ? "bg-ink text-inverse"
                  : "bg-subtle text-ink-700"
              }`}
            >
              Travel demo (Miami)
            </button>
          </div>

          {error && (
            <p className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-center text-sm text-danger">
              {error}
            </p>
          )}

          {integrations.whatsapp === "live" && (
            <div className="mt-8 rounded-2xl border border-line bg-subtle px-5 py-5">
              <p className="text-xs font-medium tracking-wider text-muted uppercase">
                WhatsApp sandbox
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>
                  Meta → app <strong>AiDHD</strong> → left sidebar{" "}
                  <strong>Use cases</strong> (not a menu named “WhatsApp”)
                </li>
                <li>
                  Open <strong>Connect with customers through WhatsApp</strong> →{" "}
                  <strong>Step 1. Try it out</strong>
                </li>
                <li>
                  On <strong>Send a message from your test number</strong>, open
                  the <strong>Recipient</strong> dropdown →{" "}
                  <strong>Manage phone number list</strong> /{" "}
                  <strong>Add phone number</strong>
                </li>
                <li>
                  Enter friend&apos;s number with country code → they get a
                  WhatsApp code → they accept → status must show allowed
                </li>
                <li>
                  Paste those numbers below → Text friends → they reply in the
                  chat from <strong>+1 (555) 158-1137</strong>
                </li>
              </ol>
              <textarea
                value={waPhones}
                onChange={(e) => setWaPhones(e.target.value)}
                placeholder="+15551234567, +15559876543"
                rows={2}
                className="mt-4 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-ink"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void inviteWhatsApp()}
                className="mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-inverse disabled:opacity-50"
              >
                {busy ? "Sending…" : "Text friends to collect prefs"}
              </button>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-medium tracking-wider text-muted uppercase">
                  Dual-agent research call
                </p>
                <p className="mt-1 text-sm text-muted">
                  Concierge stays with you; research agent calls the venue
                  (go-kart height limits, hotel policy…). Uses ElevenAgents
                  Hotel / Research templates when keyed — otherwise simulates.
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
                  className="mt-3 rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  Demo: call track about height limit
                </button>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-medium tracking-wider text-muted uppercase">
                  If WhatsApp stays silent — reply here
                </p>
                <p className="mt-1 text-sm text-muted">
                  Meta webhook tunnels go stale. This sends the bot reply to your
                  phone without waiting on Meta inbound.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={waReplyPhone}
                    onChange={(e) => setWaReplyPhone(e.target.value)}
                    placeholder="+17735411355"
                    className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink sm:w-44"
                  />
                  <input
                    value={waReplyMsg}
                    onChange={(e) => setWaReplyMsg(e.target.value)}
                    placeholder="PLAN"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void simulateWhatsAppReply()}
                    className="rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Send as WhatsApp reply
                  </button>
                </div>
              </div>
              {waNote && (
                <p className="mt-3 text-sm text-muted">{waNote}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center gap-2 border-b border-subtle bg-subtle/80 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-danger" />
              <div className="h-2 w-2 rounded-full bg-warning" />
              <div className="h-2 w-2 rounded-full bg-ink" />
              <span className="ml-2 text-sm font-medium text-muted">
                AiDHD — {snap?.event.title ?? "loading…"}
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {phase === "idle" && (
                <div className="py-8 text-center">
                  <p className="text-muted">
                    Load the demo group, then watch plans appear.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startDemo()}
                    className="mt-6 rounded-xl bg-ink px-6 py-3 font-semibold text-inverse shadow-card disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Start demo"}
                  </button>
                </div>
              )}

              {(phase === "group" || phase === "plans" || phase === "pay" || phase === "done") && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wider text-muted uppercase">
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
                          className="rounded-xl bg-subtle px-3 py-3"
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="font-semibold text-ink">
                              {name}
                            </span>
                            <span className="text-sm font-semibold text-ink">
                              ${r.budget_cap}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">
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
                  <p className="mb-3 text-xs font-medium tracking-wider text-muted uppercase">
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
                            ? "border-ink bg-subtle shadow-card"
                            : "border-line bg-subtle hover:border-ink/40"
                        } disabled:cursor-default`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display text-ink">
                              {pkg.label}
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {snap?.event?.proposed_dates?.length
                                ? `Event window: ${snap.event.proposed_dates.join(" → ")}`
                                : null}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted">
                              {pkg.rationale}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {pkg.components.map((c, i) => (
                                <span
                                  key={i}
                                  className="rounded-md bg-surface px-2 py-0.5 text-[11px] text-muted"
                                >
                                  {c.vendor}
                                  {c.vendor_verified ? " · Senso" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-semibold text-ink">
                              ${pkg.total_cost}
                            </div>
                            <div className="text-xs text-muted">
                              ${pkg.cost_per_person}/person
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {phase === "plans" && (
                    <p className="mt-3 text-center text-xs text-muted">
                      Tap a plan to request Prava payment limits
                    </p>
                  )}
                </div>
              )}

              {(phase === "pay" || phase === "done") && (
                <div>
                  <p className="mb-3 text-xs font-medium tracking-wider text-muted uppercase">
                    Pay with Prava — one limit per category
                  </p>
                  <div className="space-y-2">
                    {(snap?.mandates ?? []).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-line bg-subtle px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold capitalize text-ink">
                            {m.category}
                            <span className="font-normal text-muted">
                              {" "}
                              · {m.merchant}
                            </span>
                          </div>
                          <div className="text-xs text-muted">
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
                      className="mt-5 w-full rounded-xl bg-ink py-3.5 font-semibold text-inverse shadow-card disabled:opacity-50"
                    >
                      {busy ? "Booking…" : "Approve & book"}
                    </button>
                  )}
                </div>
              )}

              {phase === "done" && (
                <div className="rounded-xl border border-line bg-subtle p-4 text-center">
                  <p className="font-display text-lg font-semibold text-ink">
                    Booked
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-muted">
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
                      <p className="mb-2 text-xs font-medium tracking-wider text-muted uppercase">
                        Voice agent confirm
                      </p>
                      <audio controls src={voiceClip} className="mx-auto w-full max-w-sm" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void resetDemo()}
                    className="mt-5 text-sm font-semibold text-ink"
                  >
                    Run again
                  </button>
                </div>
              )}
            </div>
          </div>

          {recommendedPlaces.length > 0 && (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="mb-3 text-xs font-medium tracking-wider text-muted uppercase">
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
                      className={`cursor-default rounded-xl border px-3 py-2 transition ${
                        hoveredPlaceId === p.id
                          ? "border-ink bg-subtle"
                          : "border-line bg-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {p.label}
                        </span>
                        <span className="text-xs font-semibold text-ink">
                          ${p.cost}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
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
        </div>
      </section> */}

      {/* Footer */}
      {/* <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="font-display font-bold text-neutral-900">AiDHD</p>
          <p className="mt-1 text-sm text-neutral-500">
            Built for Prava&apos;s Agentic Commerce Hackathon
          </p>
        </div>
      </footer> */}
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
          ? "bg-line text-ink"
          : status === "failed"
            ? "bg-danger-soft text-danger"
            : "bg-line text-muted"
      }`}
    >
      {status}
    </span>
  );
}