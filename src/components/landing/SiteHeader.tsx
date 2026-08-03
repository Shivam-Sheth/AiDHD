"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";

const NAV_LINKS: [string, string][] = [
  ["how-it-works", "How it works"],
  ["use-cases", "Use cases"],
];

/**
 * Light, full-width bar at rest, with curved bottom corners only (it sits
 * flush against the top of the viewport, so top corners would never be
 * visible anyway). Fades to a floating rounded pill on scroll, and stays
 * that way (only re-expands back at the top). The pill is always the
 * *inverse* of the page theme (--navpill-* in globals.css) — dark pill on a
 * light page, light pill on a dark page — rather than a fixed dark night
 * palette, so it stays a deliberate accent in both themes instead of
 * disappearing into the page on scroll in dark mode.
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
  onScrollTo,
}: {
  onScrollTo: (id: string) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const { loggedIn, openLogin, requireAuth } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const goPlanShop = () => requireAuth(() => router.push("/agent"));
  const startGroupBuy = () => requireAuth(() => router.push("/groups/new"));
  const goToAccount = () => router.push("/account");

  /** The scrolled pill is deliberately the *inverse* of the page theme (see
   * --navpill-* in globals.css), so the logo variant has to track the pill's
   * actual background, not just the page theme — matching that inversion
   * here is what keeps the wordmark legible in all four combinations. */
  const logoOnDarkBg = scrolled ? theme === "light" : theme === "dark";

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
      {/* grid, not flex+justify-between: an absolutely-centered nav could
          overlap the logo/buttons whenever the pill's capped width made
          them collide (verified — it did, between roughly 768–1050px). A
          3-column grid reserves the outer columns to their own content
          width first, so the center column (and the nav centered inside
          it) can never overlap them, at any width. */}
      <div
        className={`grid w-full grid-cols-[auto_1fr_auto] items-center transition-all duration-500 ease-in-out ${
          scrolled
            ? "mt-3 max-w-5xl gap-4 rounded-full border border-[var(--navpill-border)] bg-[var(--navpill-bg)]/90 px-5 py-0.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
            : "mt-0 max-w-full gap-4 rounded-t-none rounded-b-3xl border-b border-[var(--line)] bg-[var(--surface)]/95 px-3 py-1 shadow-lg shadow-black/5 backdrop-blur-md lg:px-8"
        }`}
      >
        {/* Bar padding was trimmed by the same amount the logo grew (py-4→py-3
            unscrolled, py-2.5→py-1.5 scrolled), so the outer bar height is
            unchanged even though the logo itself is now noticeably larger. */}
        <button
          type="button"
          onClick={() => onScrollTo("top")}
          className="shrink-0 transition-opacity duration-500 hover:opacity-75"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoOnDarkBg ? "/pact-logo-dark.svg" : "/pact-logo-light.svg"}
            alt="Pact"
            className="h-15 w-auto"
          />
        </button>

        <nav
          className={`hidden items-center justify-self-center divide-x md:flex ${
            scrolled ? "divide-[var(--navpill-border)]" : "divide-[var(--line)]"
          }`}
        >
          {NAV_LINKS.map(([id, label]) => (
            <button
              key={`${id}-${label}`}
              type="button"
              onClick={() => onScrollTo(id)}
              className={`px-4 text-sm font-medium whitespace-nowrap transition-colors duration-500 ${
                scrolled
                  ? "text-[var(--navpill-text-muted)] hover:text-[var(--navpill-text)]"
                  : "text-[var(--muted)] hover:text-[var(--accent)]"
              }`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/reel"
            className={`px-4 text-sm font-medium whitespace-nowrap transition-colors duration-500 ${
              scrolled
                ? "text-[var(--navpill-accent-ink)] hover:text-[var(--navpill-text)]"
                : "text-[var(--coral)] hover:text-[var(--coral-hover)]"
            }`}
          >
            Reel → itinerary
          </Link>
          <button
            type="button"
            onClick={goPlanShop}
            className={`px-4 text-sm font-medium whitespace-nowrap transition-colors duration-500 ${
              scrolled
                ? "text-[var(--navpill-accent-ink)] hover:text-[var(--navpill-text)]"
                : "text-[var(--coral)] hover:text-[var(--coral-hover)]"
            }`}
          >
            Plan / Shop
          </button>
          <button
            type="button"
            onClick={startGroupBuy}
            className={`px-4 text-sm font-medium whitespace-nowrap transition-colors duration-500 ${
              scrolled
                ? "text-[var(--navpill-accent-ink)] hover:text-[var(--navpill-text)]"
                : "text-[var(--coral)] hover:text-[var(--coral-hover)]"
            }`}
          >
            Start a group buy
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle
            className={
              scrolled ?
                "text-[var(--navpill-text-muted)] hover:bg-[var(--navpill-hover-bg)] hover:text-[var(--navpill-text)]"
              : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--accent)]"
            }
          />
          {loggedIn ?
            <button
              type="button"
              onClick={goToAccount}
              aria-label="Account"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                scrolled ?
                  "text-[var(--navpill-text-muted)] hover:bg-[var(--navpill-hover-bg)] hover:text-[var(--navpill-text)]"
                : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--accent)]"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            </button>
          : <button
              type="button"
              onClick={openLogin}
              className="shrink-0 rounded-full bg-[var(--coral)] px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-[var(--coral-shadow)] transition duration-300 hover:bg-[var(--coral-hover)]"
            >
              Sign in
            </button>
          }
        </div>
      </div>
    </header>
  );
}
