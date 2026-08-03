"use client";

import Link from "next/link";
import clsx from "clsx";
import type { MockEvent } from "@/lib/mock/types";

const STEPS: { n: number; label: string; href: (slug: string, event?: MockEvent) => string; enabled: (event?: MockEvent) => boolean }[] = [
  { n: 1, label: "Start", href: () => "/events/new", enabled: () => true },
  { n: 2, label: "Collect", href: (slug) => `/e/${slug}/collect`, enabled: (event) => !!event },
  { n: 3, label: "Status", href: (slug) => `/e/${slug}/status`, enabled: (event) => !!event },
  { n: 4, label: "Packages", href: (slug) => `/e/${slug}/packages`, enabled: (event) => !!event },
  {
    n: 5,
    label: "Detail",
    href: (slug, event) => `/e/${slug}/packages/${event?.lastViewedPackageId ?? ""}`,
    enabled: (event) => !!event?.lastViewedPackageId,
  },
  {
    n: 6,
    label: "Booked",
    href: (slug) => `/e/${slug}/booked`,
    enabled: (event) => !!event && event.bookings.length > 0,
  },
];

export function StepPills({
  current,
  slug,
  event,
}: {
  current: number;
  slug?: string;
  event?: MockEvent;
}) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Flow progress">
      {STEPS.map((step) => {
        const active = step.n === current;
        const enabled = step.enabled(event);
        const label = `${step.n} · ${step.label}`;

        if (!enabled) {
          return (
            <span
              key={step.n}
              aria-disabled
              className="cursor-not-allowed rounded-full border border-line/60 bg-surface/60 px-4 py-2 text-sm font-medium text-faint"
            >
              {label}
            </span>
          );
        }

        return (
          <Link
            key={step.n}
            href={step.href(slug ?? "", event)}
            aria-current={active ? "step" : undefined}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink hover:border-ink/40",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
