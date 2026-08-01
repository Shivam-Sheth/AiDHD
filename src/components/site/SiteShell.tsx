"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Starfield } from "@/components/site/Starfield";
import { ThemeToggle } from "@/components/ThemeProvider";

type NavLink = { href: string; label: string };

const DEFAULT_LINKS: NavLink[] = [
  { href: "/#about", label: "About" },
  { href: "/agent", label: "Agent" },
  { href: "/reel", label: "Reel" },
];

export function SiteShell({
  children,
  links = DEFAULT_LINKS,
  joinHref = "/login",
  joinLabel = "Join us",
  showJoin = true,
  compact = false,
  trailing,
}: {
  children: ReactNode;
  links?: NavLink[];
  joinHref?: string;
  joinLabel?: string;
  showJoin?: boolean;
  compact?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <Starfield />
      <header
        className={`fixed inset-x-0 top-0 z-50 ${
          compact ? "border-b border-[var(--edge)] bg-[var(--void)]/70 backdrop-blur-md" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-10">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-[0.08em] text-[var(--ink)] uppercase"
          >
            AiDHD
          </Link>
          <div className="flex items-center gap-5 sm:gap-7">
            <nav className="hidden items-center gap-6 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className="font-mono text-[11px] tracking-[0.16em] text-[var(--inksoft)] uppercase transition-colors hover:text-[var(--ink)]"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <ThemeToggle className="font-mono text-[10px] tracking-[0.14em] text-[var(--inkmute)] uppercase border border-[var(--edge)] px-2 py-1 hover:border-[var(--edgehot)] hover:text-[var(--ink)]" />
            {trailing}
            {showJoin && (
              <Link href={joinHref} className="btn-join">
                {joinLabel}
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
