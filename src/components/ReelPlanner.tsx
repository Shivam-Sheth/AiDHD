"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  FlightOfferCard,
  StayOfferCard,
} from "@/components/booking/OfferCards";
import { ThemeToggle } from "@/components/ThemeProvider";
import type { ReelClarifyAsk, ReelPlanResult } from "@/lib/reel/types";

type Draft = {
  party_size: string;
  date_range: string;
  selected_date: string;
  origin_city: string;
  selected_time: string;
};

const emptyDraft = (): Draft => ({
  party_size: "",
  date_range: "",
  selected_date: "",
  origin_city: "",
  selected_time: "",
});

export function ReelPlanner() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReelPlanResult | null>(null);
  const [result, setResult] = useState<ReelPlanResult | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [cachedCaption, setCachedCaption] = useState("");
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "preview" | "final">("idle");

  const active = result || preview;
  const asks = preview?.asks || [];

  const missing = useMemo(() => {
    const need = new Set(asks.map((a) => a.field));
    const miss: string[] = [];
    if (need.has("party_size") && !draft.party_size) miss.push("party size");
    if (
      (need.has("date_range") || need.has("date_pick")) &&
      !draft.date_range &&
      !draft.selected_date
    ) {
      miss.push("dates");
    }
    if (need.has("origin") && !draft.origin_city.trim()) miss.push("origin city");
    if (need.has("time_pick") && !draft.selected_time) miss.push("time");
    return miss;
  }, [asks, draft]);

  function draftToPayload() {
    return {
      party_size: draft.party_size ? Number(draft.party_size) : undefined,
      date_range: draft.date_range.trim() || undefined,
      selected_date: draft.selected_date || undefined,
      origin_city: draft.origin_city.trim() || undefined,
      selected_time: draft.selected_time || undefined,
    };
  }

  function readReel(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!/instagram\.com|instagr\.am|tiktok\.com/i.test(trimmedUrl)) {
      setError("Need a public Instagram or TikTok link.");
      return;
    }
    setError(null);
    setResult(null);
    setPreview(null);
    setDraft(emptyDraft());
    setCachedCaption("");
    setPhase("idle");
    startTransition(async () => {
      try {
        const res = await fetch("/api/reel/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: trimmedUrl,
            stage: "preview",
            relaxed: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Read failed");
        const plan = data as ReelPlanResult;
        setPreview(plan);
        setCachedCaption(plan.cached_caption || "");
        setPhase("preview");
        setDraft({
          party_size: plan.brief.party_size_hint
            ? String(plan.brief.party_size_hint)
            : "",
          date_range: "",
          selected_date: plan.brief.dates[0] || "",
          origin_city: plan.brief.origin_city || "",
          selected_time: "",
        });
      } catch (err) {
        setPreview(null);
        setError(err instanceof Error ? err.message : "Something broke");
      }
    });
  }

  function buildFullPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || missing.length) {
      setError(
        missing.length
          ? `Still need: ${missing.join(", ")}`
          : "Read a reel first.",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reel/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            stage: "finalize",
            cached_caption: cachedCaption || undefined,
            relaxed: false,
            ...draftToPayload(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Plan failed");
        const plan = data as ReelPlanResult;
        setResult(plan);
        setPreview(plan);
        setPhase("final");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something broke");
      }
    });
  }

  function setAskOption(ask: ReelClarifyAsk, value: string) {
    if (ask.field === "party_size") {
      setDraft((d) => ({ ...d, party_size: value }));
    } else if (ask.field === "date_pick") {
      if (value === "other") {
        setDraft((d) => ({ ...d, selected_date: "", date_range: d.date_range }));
        return;
      }
      setDraft((d) => ({ ...d, selected_date: value, date_range: "" }));
    } else if (ask.field === "time_pick") {
      setDraft((d) => ({ ...d, selected_time: value }));
    }
  }

  const brief = active?.brief;
  const budgetLabel = (() => {
    if (!brief) return null;
    if (brief.budget_note) return brief.budget_note;
    const cur = brief.budget_currency || "USD";
    const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : `${cur} `;
    if (brief.budget_cap != null) {
      const pp = `${sym}${Math.round(brief.budget_cap)}/pp`;
      if (brief.budget_total != null) {
        return `${pp} · ${sym}${Math.round(brief.budget_total)} group`;
      }
      return pp;
    }
    if (brief.budget_total != null) {
      return `${sym}${Math.round(brief.budget_total)} total`;
    }
    return null;
  })();

  const showPackage = phase === "final" && result;

  const chip = (on: boolean) =>
    on
      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--btn-fg)]"
      : "border-[var(--edge)] text-[var(--inksoft)] hover:border-[var(--edgehot)]";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 site-atmosphere"
        aria-hidden
      />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
        >
          AiDHD
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
          >
            Home
          </Link>
          <Link
            href="/agent"
            className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
          >
            Live agent
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6">
        <section className="animate-fade-in">
          <p className="text-xs font-medium tracking-[0.14em] text-[var(--inkmute)] uppercase">
            Reel → plan
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
            Paste the link.
            <br />
            Prefs once. Full plan.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--inksoft)]">
            We read the reel once, you fill dates and origin, then we build days
            + flights + stays in one shot.
          </p>
        </section>

        <form onSubmit={readReel} className="animate-slide-up mt-10 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--inksoft)]">
              Reel link
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…"
              className="field"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>

          {error && (
            <p className="border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:cursor-wait disabled:opacity-60"
          >
            {pending && phase === "idle"
              ? "Reading reel…"
              : preview
                ? "Re-read reel"
                : "Read reel"}
          </button>
        </form>

        {active && (
          <div className="mt-14 space-y-10 animate-fade-in">
            <div>
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--inkmute)] uppercase">
                From the reel
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold text-[var(--ink)]">
                {active.brief.title}
              </h2>
              <p className="mt-2 text-[var(--inksoft)]">{active.brief.summary}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--inkmute)]">
                {active.brief.city && <span>City · {active.brief.city}</span>}
                {active.brief.mode && <span>Mode · {active.brief.mode}</span>}
                {budgetLabel && <span>Budget · {budgetLabel}</span>}
                {active.brief.days != null && (
                  <span>~{active.brief.days} days</span>
                )}
              </div>
              {active.brief.places.length > 0 && (
                <p className="mt-3 text-sm text-[var(--inksoft)]">
                  <span className="font-medium text-[var(--ink)]">Places: </span>
                  {active.brief.places.slice(0, 12).join(" · ")}
                </p>
              )}
            </div>

            {asks.length > 0 && phase !== "final" && (
              <form onSubmit={buildFullPlan} className="surface p-5">
                <h3 className="font-display text-lg font-semibold text-[var(--ink)]">
                  Your preferences
                </h3>
                <p className="mt-1 text-sm text-[var(--inksoft)]">
                  Fill everything below, then submit once — we won&apos;t re-read
                  the reel.
                </p>

                <div className="mt-4 space-y-5">
                  {asks.map((ask) => (
                    <div key={ask.field}>
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {ask.prompt}
                      </p>
                      {ask.field === "party_size" && ask.options?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ask.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAskOption(ask, opt)}
                              className={`border px-3 py-1.5 text-sm transition ${chip(draft.party_size === opt)}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : ask.field === "date_pick" && ask.options?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ask.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAskOption(ask, opt)}
                              className={`border px-3 py-1.5 text-sm transition ${chip(draft.selected_date === opt)}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : ask.field === "date_range" ? (
                        <input
                          value={draft.date_range}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              date_range: e.target.value,
                              selected_date: "",
                            }))
                          }
                          placeholder="Sep 20–25"
                          className="field mt-2"
                        />
                      ) : ask.field === "origin" ? (
                        <input
                          value={draft.origin_city}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              origin_city: e.target.value,
                            }))
                          }
                          placeholder="Chicago"
                          className="field mt-2"
                        />
                      ) : ask.field === "time_pick" && ask.options?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ask.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAskOption(ask, opt)}
                              className={`border px-3 py-1.5 text-sm transition ${chip(draft.selected_time === opt)}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={pending || missing.length > 0}
                  className="btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending && phase === "preview"
                    ? "Building plan…"
                    : missing.length
                      ? `Need ${missing.join(", ")}`
                      : "Build full plan"}
                </button>
              </form>
            )}

            {showPackage && (
              <>
                <div className="surface px-4 py-3 text-sm">
                  <p className="font-display font-semibold text-[var(--ink)]">
                    Money snapshot
                  </p>
                  <p className="mt-1 text-[var(--inksoft)]">
                    {budgetLabel
                      ? `Land budget from reel · ${budgetLabel}`
                      : "Land budget from reel · see day plan"}
                    {result.flights[0] && (
                      <>
                        {" "}
                        · Flights from ~$
                        {Math.round(
                          Math.min(
                            ...result.flights.map((f) => f.price_per_person),
                          ),
                        )}
                        /pp
                      </>
                    )}
                    {result.hotels[0] && (
                      <>
                        {" "}
                        · Stays from ~$
                        {Math.round(
                          Math.min(...result.hotels.map((h) => h.price_total)),
                        )}{" "}
                        total
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[var(--inkmute)]">
                    Per-person land budget is calculated from the reel caption.
                    Flight/stay quotes are separate USD options.
                  </p>
                </div>

                <div className="space-y-10">
                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                        Flight options
                      </h3>
                      {result.flights.length > 0 && (
                        <p className="text-xs text-[var(--inkmute)]">
                          {result.flights[0]!.from} → {result.flights[0]!.to}
                        </p>
                      )}
                    </div>
                    {result.flights.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--inkmute)]">
                        No flights yet — set origin city and rebuild.
                      </p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {result.flights.map((f) => (
                          <li key={f.id}>
                            <FlightOfferCard
                              airline={f.airline}
                              airlineLogo={f.airline_logo_url}
                              from={f.from}
                              to={f.to}
                              depart={f.depart}
                              arrive={f.arrive}
                              cabin={f.cabin}
                              price={f.price_per_person}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                        Stays · ranked by reviews
                      </h3>
                      {result.hotels[0]?.rating != null && (
                        <p className="text-xs text-[var(--inkmute)]">
                          Top score {result.hotels[0].rating.toFixed(1)}/10
                        </p>
                      )}
                    </div>
                    {result.hotels.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--inkmute)]">
                        No stays returned — check dates and rebuild.
                      </p>
                    ) : (
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {result.hotels.map((h) => (
                          <li key={h.id}>
                            <StayOfferCard
                              name={h.name}
                              neighborhood={h.neighborhood}
                              nights={h.nights}
                              rating={h.rating}
                              reviewCount={h.review_count}
                              reviewRank={h.review_rank}
                              price={h.price_total}
                              checkIn={h.check_in}
                              checkOut={h.check_out}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                    Itinerary
                  </h3>
                  <ol className="mt-4 space-y-6">
                    {result.itinerary.map((day) => (
                      <li key={day.day_label}>
                        <p className="font-display text-lg font-semibold text-[var(--ink)]">
                          {day.day_label}
                        </p>
                        <ul className="mt-2 space-y-1.5 border-l border-[var(--edge)] pl-4">
                          {day.items.map((item) => (
                            <li key={item} className="text-[var(--inksoft)]">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                </div>

                {result.tickets.length > 0 && (
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[var(--ink)]">
                      Ticketmaster matches
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {result.tickets.map((t, i) => (
                        <li
                          key={t.id}
                          className="flex gap-3 border-b border-[var(--edge)] pb-3 text-sm last:border-0"
                        >
                          <span className="font-display w-6 shrink-0 font-semibold text-[var(--inkmute)]">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-[var(--ink)]">
                              {t.event_name}
                            </p>
                            <p className="text-[var(--inkmute)]">
                              {t.venue} · ~${Math.round(t.price)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {phase === "preview" && !showPackage && active.itinerary[0] && (
              <div className="surface px-4 py-3 text-sm text-[var(--inksoft)]">
                <p className="font-medium text-[var(--ink)]">Reel snapshot</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {active.itinerary[0].items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
