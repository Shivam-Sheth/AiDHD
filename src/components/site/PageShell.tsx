"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteLinksFooter } from "./SiteLinksFooter";

/**
 * Chrome for the standalone footer-linked pages. Client-only because
 * SiteHeader is (auth + scroll state) — page content itself is passed in as
 * children, so the pages using this stay server components and keep their
 * `metadata` exports.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  width = "prose",
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  /** `prose` for reading-length text (legal, FAQ), `wide` for card grids. */
  width?: "prose" | "wide";
  children: ReactNode;
}) {
  const router = useRouter();

  /** SiteHeader's brand mark scrolls to "top" and its nav links target
   * landing-only sections — neither exists here, so both go home. */
  const scrollTo = (id: string) => {
    router.push(id === "top" ? "/" : `/#${id}`);
  };

  const inner = width === "prose" ? "max-w-3xl" : "max-w-6xl";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <SiteHeader onScrollTo={scrollTo} />

      {/* pt-32 clears the fixed header, which overlays rather than pushes. */}
      <header className="bg-hero-gradient px-6 pt-32 pb-14 lg:px-10 lg:pt-36 lg:pb-16">
        <div className={`mx-auto ${inner}`}>
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-wider text-[var(--hero-ink-faint)] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display mt-3 text-4xl font-bold text-[var(--hero-ink)] sm:text-5xl">
            {title}
          </h1>
          {lede ? (
            <div className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--hero-ink-muted)]">
              {lede}
            </div>
          ) : null}
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-6 py-14 lg:px-10 lg:py-16 ${inner}`}>
        {children}
      </main>

      <SiteLinksFooter />
    </div>
  );
}
