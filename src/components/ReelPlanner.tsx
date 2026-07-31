"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
        // Prefill from reel hints
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

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, #99f6e4 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, #a5f3fc 0%, transparent 50%), linear-gradient(180deg, #f0fdfa 0%, #fafafa 42%, #fafafa 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-pattern opacity-40" />

      <header className="mx-auto flex max-w-3xl items-baseline justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-neutral-900 transition-opacity hover:opacity-70"
        >
          AiDHD
        </Link>
        <Link
          href="/"
          className="text-sm text-neutral-500 transition-colors hover:text-teal-700"
        >
          Demo home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6">
        <section className="animate-fade-in">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
            Reel → plan
          </p>
          <h1 className="font-display mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl">
            Paste the link.
            <br />
            Prefs once. Full plan.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            We read the reel once, you fill dates and origin, then we build
            days + flights + stays in one shot.
          </p>
        </section>

        <form onSubmit={readReel} className="animate-slide-up mt-10 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-neutral-700">
              Reel link
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…"
              className="w-full rounded-xl border border-neutral-200 bg-white/80 px-4 py-3 text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-6 py-3 font-display text-base font-semibold text-white shadow-md transition hover:bg-teal-600 disabled:cursor-wait disabled:opacity-60"
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
              <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
                From the reel
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold text-neutral-900">
                {active.brief.title}
              </h2>
              <p className="mt-2 text-neutral-600">{active.brief.summary}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
                {active.brief.city && <span>City · {active.brief.city}</span>}
                {active.brief.mode && <span>Mode · {active.brief.mode}</span>}
                {budgetLabel && <span>Budget · {budgetLabel}</span>}
                {active.brief.days != null && (
                  <span>~{active.brief.days} days</span>
                )}
              </div>
              {active.brief.places.length > 0 && (
                <p className="mt-3 text-sm text-neutral-600">
                  <span className="font-medium text-neutral-800">Places: </span>
                  {active.brief.places.slice(0, 12).join(" · ")}
                </p>
              )}
            </div>

            {asks.length > 0 && phase !== "final" && (
              <form
                onSubmit={buildFullPlan}
                className="rounded-2xl border border-teal-200 bg-teal-50/80 p-5"
              >
                <h3 className="font-display text-lg font-bold text-teal-900">
                  Your preferences
                </h3>
                <p className="mt-1 text-sm text-teal-800/80">
                  Fill everything below, then submit once — we won&apos;t re-read
                  the reel.
                </p>

                <div className="mt-4 space-y-5">
                  {asks.map((ask) => (
                    <div key={ask.field}>
                      <p className="text-sm font-medium text-neutral-800">
                        {ask.prompt}
                      </p>
                      {ask.field === "party_size" && ask.options?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ask.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAskOption(ask, opt)}
                              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                draft.party_size === opt
                                  ? "border-teal-700 bg-teal-700 text-white"
                                  : "border-teal-300 bg-white text-teal-900 hover:bg-teal-100"
                              }`}
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
                              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                draft.selected_date === opt
                                  ? "border-teal-700 bg-teal-700 text-white"
                                  : "border-teal-300 bg-white text-teal-900 hover:bg-teal-100"
                              }`}
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
                          className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20"
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
                          className="mt-2 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20"
                        />
                      ) : ask.field === "time_pick" && ask.options?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ask.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAskOption(ask, opt)}
                              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                draft.selected_time === opt
                                  ? "border-teal-700 bg-teal-700 text-white"
                                  : "border-teal-300 bg-white text-teal-900 hover:bg-teal-100"
                              }`}
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
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-800 px-6 py-3 font-display text-base font-semibold text-white shadow-md transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                  <p className="font-display font-semibold">Money snapshot</p>
                  <p className="mt-1 text-amber-900/90">
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
                  <p className="mt-1 text-xs text-amber-800/80">
                    Per-person land budget is calculated from the reel caption
                    (e.g. ₹50,000 for 2 → ₹25,000/pp). Flight/stay quotes are
                    separate USD options.
                  </p>
                </div>

                <div className="space-y-10">
                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="font-display text-xl font-bold text-neutral-900">
                        Flight options
                      </h3>
                      {result.flights.length > 0 && (
                        <p className="text-xs text-neutral-500">
                          {result.flights[0]!.from} → {result.flights[0]!.to}
                        </p>
                      )}
                    </div>
                    {result.flights.length === 0 ? (
                      <p className="mt-3 text-sm text-neutral-500">
                        No flights yet — set origin city (e.g. Chicago) and
                        rebuild.
                      </p>
                    ) : (
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {result.flights.map((f) => (
                          <li
                            key={f.id}
                            className="group relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-100">
                                {f.airline_logo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={f.airline_logo_url}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="h-9 w-9 object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="font-display text-sm font-bold text-teal-800">
                                    {(f.airline_iata || f.airline.slice(0, 2)).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-display text-base font-semibold text-neutral-900">
                                  {f.airline}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  {f.cabin} · {f.source}
                                </p>
                              </div>
                              <p className="shrink-0 font-display text-lg font-bold text-teal-800">
                                ${Math.round(f.price_per_person)}
                                <span className="text-xs font-medium text-neutral-500">
                                  /pp
                                </span>
                              </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2">
                              <div>
                                <p className="font-display text-xl font-bold tracking-tight text-neutral-900">
                                  {f.from}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {new Date(f.depart).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                              <div className="flex flex-1 flex-col items-center px-2">
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
                                <span className="mt-1 text-[10px] uppercase tracking-wider text-teal-700">
                                  {f.from}–{f.to}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-display text-xl font-bold tracking-tight text-neutral-900">
                                  {f.to}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {new Date(f.arrive).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="font-display text-xl font-bold text-neutral-900">
                        Stays · ranked by reviews
                      </h3>
                      {result.hotels[0]?.rating != null && (
                        <p className="text-xs text-neutral-500">
                          Top score {result.hotels[0].rating.toFixed(1)}/10
                        </p>
                      )}
                    </div>
                    {result.hotels.length === 0 ? (
                      <p className="mt-3 text-sm text-neutral-500">
                        No stays returned — check dates and rebuild.
                      </p>
                    ) : (
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {result.hotels.map((h) => (
                          <li
                            key={h.id}
                            className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
                                    h.review_rank === 1
                                      ? "bg-teal-700 text-white"
                                      : "bg-teal-50 text-teal-800 ring-1 ring-teal-100"
                                  }`}
                                >
                                  #{h.review_rank ?? "–"}
                                </div>
                                <div>
                                  <p className="font-display text-base font-semibold leading-snug text-neutral-900">
                                    {h.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-neutral-500">
                                    {h.neighborhood} · {h.nights} nights
                                  </p>
                                </div>
                              </div>
                              <p className="shrink-0 font-display text-lg font-bold text-teal-800">
                                ${Math.round(h.price_total)}
                              </p>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {h.rating != null && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                                  <span aria-hidden>★</span>
                                  {h.rating.toFixed(1)}
                                  {h.review_count != null && (
                                    <span className="font-normal text-amber-800/70">
                                      · {h.review_count.toLocaleString()} reviews
                                    </span>
                                  )}
                                </span>
                              )}
                              {h.review_rank === 1 && (
                                <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
                                  Best reviewed
                                </span>
                              )}
                              <span className="text-xs text-neutral-400">
                                {h.check_in} → {h.check_out}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-xl font-bold text-neutral-900">
                    Itinerary
                  </h3>
                  <ol className="mt-4 space-y-6">
                    {result.itinerary.map((day) => (
                      <li key={day.day_label}>
                        <p className="font-display text-lg font-semibold text-teal-800">
                          {day.day_label}
                        </p>
                        <ul className="mt-2 space-y-1.5 border-l-2 border-teal-200 pl-4">
                          {day.items.map((item) => (
                            <li key={item} className="text-neutral-700">
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
                    <h3 className="font-display text-xl font-bold text-neutral-900">
                      Ticketmaster matches
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {result.tickets.map((t, i) => (
                        <li
                          key={t.id}
                          className="flex gap-3 border-b border-neutral-100 pb-3 text-sm last:border-0"
                        >
                          <span className="font-display w-6 shrink-0 font-bold text-teal-700">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-neutral-900">
                              {t.event_name}
                            </p>
                            <p className="text-neutral-500">
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
              <div className="rounded-xl border border-neutral-200 bg-white/50 px-4 py-3 text-sm text-neutral-600">
                <p className="font-medium text-neutral-800">Reel snapshot</p>
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
