"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { MobileMenu } from "./MobileMenu";

const LINKS: [string, string][] = [
  ["problem", "Problem"],
  ["how-it-works", "How it works"],
  ["modes", "Modes"],
  ["demo", "Demo"],
  ["testimonials", "Stories"],
];

export function SiteNav() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const ids = LINKS.map(([id]) => id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/90 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
        <a href="#top" className="font-display text-xl font-bold text-ink transition hover:text-coral-dark">
          AiDHD
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={clsx(
                "text-sm font-medium transition hover:text-coral-dark",
                active === id ? "text-coral-dark" : "text-muted",
              )}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          href="#demo"
          className="hidden rounded-full bg-gradient-to-r from-coral to-gold px-4 py-2 text-sm font-semibold text-dusk-950 shadow-warm transition hover:brightness-105 md:inline-block"
        >
          Start planning
        </a>
        <MobileMenu />
      </div>
    </header>
  );
}
