"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS: [string, string][] = [
  ["problem", "Problem"],
  ["how-it-works", "How it works"],
  ["modes", "Modes"],
  ["demo", "Demo"],
  ["testimonials", "Stories"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-surface px-6 py-4 shadow-lg">
          <nav className="flex flex-col gap-3">
            {LINKS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setOpen(false)}
                className="py-1.5 text-sm font-medium text-muted transition hover:text-coral-dark"
              >
                {label}
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-gradient-to-r from-coral to-gold px-4 py-2.5 text-center text-sm font-semibold text-dusk-950"
            >
              Start planning
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
