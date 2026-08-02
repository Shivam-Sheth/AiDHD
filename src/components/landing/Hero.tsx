"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LogoMarquee } from "./LogoMarquee";
import { GroupPlanningAnimation } from "./GroupPlanningAnimation";

const HeroScene = dynamic(
  () => import("./HeroScene").then((m) => m.HeroScene),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * Headline options considered:
 * 1. "The group chat ends. The plan begins." (implemented)
 * 2. "Everyone chips in. One agent books it."
 * 3. "Stop reply-alling your vacation."
 */

const LOOP_STEPS = [
  "Budgets & vibes in",
  "Agent reconciles",
  "2–3 costed options",
  "One tap books",
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
  const [sceneUnavailable, setSceneUnavailable] = useState(false);

  return (
    <section id="top" className="bg-night-road relative overflow-hidden">
      {/* Three.js scene is now an ambient backdrop behind the two-column
          layout, not the focal centerpiece — falls back to the CSS gradient
          above (bg-night-road) if WebGL isn't available or while the chunk loads. */}
      <div className="absolute inset-0">
        {!sceneUnavailable && (
          <HeroScene onUnavailable={() => setSceneUnavailable(true)} />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--night)] via-transparent to-transparent" />

      {/* pt-16 clears the fixed SiteHeader's unscrolled height (h-16 equivalent).
          flex-col + flex-1 so the logo band below sits in normal flow at the
          bottom instead of overlapping short viewports as an absolute overlay. */}
      <div className="relative flex min-h-[70vh] flex-col pt-16">
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-6 py-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:px-10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="animate-fade-in rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--coral-soft)] uppercase backdrop-blur-sm">
              Group nights & trips, planned by one agent
            </span>

            <h1 className="animate-fade-in font-display mt-5 max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              The group chat ends.
              <br />
              <span className="bg-gradient-to-r from-[var(--coral)] to-[var(--coral-hover)] bg-clip-text text-transparent">
                The plan begins.
              </span>
            </h1>

            <p className="animate-fade-in mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              Everyone drops a budget and a vibe — for a Friday concert or a
              week-long trip. Our agent turns the whole group&apos;s input
              into 2–3 fully costed plans, then books the one you pick.
            </p>

            <div className="animate-slide-up mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              <button
                type="button"
                disabled={busy}
                onClick={onStartPlanning}
                className="rounded-xl bg-[var(--coral)] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[var(--coral-shadow)] transition hover:bg-[var(--coral-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Reconciling the group…" : "Start planning →"}
              </button>
              <button
                type="button"
                onClick={onSeeHowItWorks}
                className="rounded-xl border-2 border-white/20 px-6 py-3.5 font-semibold text-white/90 transition hover:border-white/40 hover:bg-white/5"
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

        <div className="relative border-t border-white/10 bg-black/20 py-3 backdrop-blur-sm">
          <p className="mb-2 text-center text-[10px] font-semibold tracking-widest text-white/30 uppercase">
            INTEGRATIONS
          </p>
          <LogoMarquee />
        </div>
      </div>
    </section>
  );
}
