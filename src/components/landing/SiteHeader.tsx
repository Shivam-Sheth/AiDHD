"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS: [string, string][] = [
  ["use-cases", "Nights & trips"],
  ["how-it-works", "How it works"],
];

/**
 * Light, full-width bar at rest, with curved bottom corners only (it sits
 * flush against the top of the viewport, so top corners would never be
 * visible anyway). Fades to the hero's dark night palette as it compresses
 * into a floating rounded pill on scroll, and stays that way (only
 * re-expands/re-lightens back at the top).
 *
 * Same element throughout; only its classes toggle, so box-model/radius/
 * color all animate as one continuous morph. Three things that used to break
 * that:
 *   1. `max-w-none` can't be smoothly interpolated to a concrete max-width
 *      (browsers just snap it instantly) — the unscrolled state uses
 *      `max-w-full` instead, still 100% width but an actual animatable length.
 *   2. Each child's own `transition-colors` needs the same duration as the
 *      container's `transition-all`, or text snaps into its new color while
 *      the shape is still mid-morph.
 *   3. A front-loaded easing curve (e.g. an ease-out-quint style bezier)
 *      finishes ~95% of the width change in the first ~15% of the duration —
 *      technically animating, but perceived as an instant snap. `ease-in-out`
 *      paces the motion evenly across the whole duration instead.
 */
export function SiteHeader({
  busy,
  onScrollTo,
  onStartPlanning,
}: {
  busy: boolean;
  onScrollTo: (id: string) => void;
  onStartPlanning: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Hysteresis: different enter/exit thresholds so hovering right around
    // one scroll value doesn't flicker the transition back and forth.
    const onScroll = () => {
      setScrolled((prev) => {
        if (window.scrollY > 72) return true;
        if (window.scrollY < 24) return false;
        return prev;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3">
      <div
        className={`flex w-full items-center justify-between transition-all duration-500 ease-in-out ${
          scrolled
            ? "mt-3 max-w-4xl gap-4 rounded-full border border-white/10 bg-[var(--night)]/90 px-5 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
            : "mt-0 max-w-full gap-4 rounded-t-none rounded-b-3xl border-b border-neutral-200/80 bg-white/95 px-3 py-4 shadow-lg shadow-black/5 backdrop-blur-md lg:px-8"
        }`}
      >
        <button
          type="button"
          onClick={() => onScrollTo("top")}
          className={`font-display shrink-0 text-lg font-bold transition-colors duration-500 ${
            scrolled
              ? "text-white hover:text-white/80"
              : "text-neutral-900 hover:text-[var(--accent)]"
          }`}
        >
          AiDHD
        </button>

        <nav className="hidden items-center gap-5 md:flex lg:gap-7">
          {NAV_LINKS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onScrollTo(id)}
              className={`text-sm font-medium whitespace-nowrap transition-colors duration-500 ${
                scrolled
                  ? "text-white/70 hover:text-white"
                  : "text-neutral-600 hover:text-[var(--accent)]"
              }`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/reel"
            className={`hidden text-sm font-medium whitespace-nowrap transition-colors duration-500 lg:inline ${
              scrolled
                ? "text-[var(--coral-soft)] hover:text-white"
                : "text-[var(--coral)] hover:text-[var(--coral-hover)]"
            }`}
          >
            Reel → itinerary
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/login"
            className={`hidden text-sm font-medium transition-colors duration-500 sm:inline ${
              scrolled
                ? "text-white/70 hover:text-white"
                : "text-neutral-600 hover:text-[var(--accent)]"
            }`}
          >
            Sign in
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={onStartPlanning}
            className="shrink-0 rounded-full bg-[var(--coral)] px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-[var(--coral-shadow)] transition duration-300 hover:bg-[var(--coral-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Start planning"}
          </button>
        </div>
      </div>
    </header>
  );
}
