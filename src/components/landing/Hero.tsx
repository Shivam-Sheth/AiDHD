"use client";

import { LogoMarquee } from "./LogoMarquee";
import { GroupPlanningAnimation } from "./GroupPlanningAnimation";

const LOOP_STEPS = [
  "Friends join the window",
  "Agent recommends picks",
  "Threshold tracked live",
  "One prava checkout",
];

export function Hero({
  busy,
  error,
  onStartPlanning,
  onSeeHowItWorks,
}: {
  busy: boolean;
  error: string | null;
  onStartPlanning: () => void;
  onSeeHowItWorks: () => void;
}) {
  return (
    <section id="top" className="bg-hero-gradient relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--hero-bg-1)] via-transparent to-transparent" />

      {/* pt-16 clears the fixed SiteHeader's unscrolled height (h-16 equivalent).
          flex-col + flex-1 so the logo band below sits in normal flow at the
          bottom instead of overlapping short viewports as an absolute overlay. */}
      <div className="relative flex min-h-[70vh] flex-col pt-16">
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-6 py-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:px-10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="animate-fade-in rounded-full border border-[var(--hero-pill-border)] bg-[var(--hero-pill-bg)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--hero-accent-ink)] uppercase backdrop-blur-sm">
              Group buys, live in a 2-hour window
            </span>

            <h1 className="animate-fade-in font-display mt-5 max-w-xl text-4xl font-bold tracking-tight text-[var(--hero-ink)] sm:text-4xl lg:text-5xl">
              The discount code dies.
              <br />
              <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--coral-gradient)] bg-clip-text text-transparent">
                The group buy begins.
              </span>
            </h1>

            <p className="animate-fade-in mt-5 max-w-lg text-lg leading-relaxed text-[var(--hero-ink-muted)]">
              Everyone in the group gets one 2-hour window to fill their cart.
              Cross the combined spend threshold together and the discount
              unlocks for the whole group — the agent recommends what to add,
              prava checks everyone out before the clock hits zero.
            </p>

            <div className="animate-slide-up mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              <button
                type="button"
                disabled={busy}
                onClick={onStartPlanning}
                className="rounded-xl bg-[var(--coral)] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[var(--coral-shadow)] transition hover:bg-[var(--coral-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Opening the window…" : "Start a group buy →"}
              </button>
              <button
                type="button"
                onClick={onSeeHowItWorks}
                className="rounded-xl border-2 border-[var(--hero-pill-border)] px-6 py-3.5 font-semibold text-[var(--hero-ink-muted)] transition hover:border-[var(--hero-divider)] hover:bg-[var(--hero-pill-bg)]"
              >
                See how it works
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>

          <div className="hidden w-full lg:mx-auto lg:block lg:max-w-[360px] xl:max-w-[400px]">
            <GroupPlanningAnimation />
          </div>
        </div>

        <div className="relative border-t border-[var(--hero-divider)] bg-[var(--hero-band-bg)] py-3 backdrop-blur-sm">
          <p className="mb-2 text-center text-[10px] font-semibold tracking-widest text-[var(--hero-ink-muted)] uppercase">
            INTEGRATIONS
          </p>
          <LogoMarquee />
        </div>
      </div>
    </section>
  );
}
