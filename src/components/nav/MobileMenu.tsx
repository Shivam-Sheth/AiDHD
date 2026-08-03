"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS: [string, string][] = [
  ["problem", "Manifesto"],
  ["how-it-works", "How it works"],
  ["modes", "Modes"],
  ["demo", "Demo"],
  ["testimonials", "Stories"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:bg-subtle"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-canvas px-6 py-4">
          <nav className="flex flex-col">
            {LINKS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setOpen(false)}
                className="micro focus-ring border-b border-line py-3.5 text-muted transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
            <a
              href="/login"
              onClick={() => setOpen(false)}
              className="micro focus-ring mt-4 rounded-full bg-accent px-4 py-3 text-center text-accent-ink"
            >
              Join us
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
