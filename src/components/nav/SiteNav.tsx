"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MobileMenu } from "./MobileMenu";

const LINKS: [string, string][] = [
  ["problem", "Manifesto"],
  ["how-it-works", "How it works"],
  ["modes", "Modes"],
  ["demo", "Demo"],
  ["testimonials", "Stories"],
];

export function SiteNav() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    for (const [id] of LINKS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled && "border-b border-line bg-canvas/85 backdrop-blur-md",
      )}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
        <a href="#top" className="focus-ring font-display text-base tracking-tight text-ink">
          Pact
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={clsx(
                "micro focus-ring transition-colors hover:text-ink",
                active === id ? "text-ink" : "text-muted",
              )}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <a
            href="/groups"
            className="micro focus-ring rounded-full bg-accent px-4 py-2 text-accent-ink transition-opacity hover:opacity-90"
          >
            Host a party
          </a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
