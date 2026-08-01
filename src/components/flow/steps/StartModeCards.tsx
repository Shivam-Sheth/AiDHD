"use client";

import clsx from "clsx";
import { Plane, PartyPopper } from "lucide-react";
import type { EventType } from "@/lib/mock/types";

const MODES: {
  type: EventType;
  title: string;
  subtitle: string;
  icon: typeof Plane;
}[] = [
  { type: "trip", title: "A trip", subtitle: "Multi-day, flights & a hotel", icon: Plane },
  { type: "outing", title: "A night out", subtitle: "Show, dinner, one good night", icon: PartyPopper },
];

export function StartModeCards({
  value,
  onChange,
}: {
  value: EventType;
  onChange: (next: EventType) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MODES.map((mode) => {
        const selected = value === mode.type;
        const Icon = mode.icon;
        return (
          <button
            key={mode.type}
            type="button"
            onClick={() => onChange(mode.type)}
            aria-pressed={selected}
            className={clsx(
              "rounded-2xl border p-5 text-left transition",
              selected ? "border-coral bg-coral/10" : "border-line bg-paper hover:border-coral-dark/30",
            )}
          >
            <span
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                selected ? "bg-coral/25 text-coral-dark" : "bg-line/60 text-muted",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-base font-bold text-ink">{mode.title}</p>
            <p className="mt-1 text-sm text-muted">{mode.subtitle}</p>
          </button>
        );
      })}
    </div>
  );
}
