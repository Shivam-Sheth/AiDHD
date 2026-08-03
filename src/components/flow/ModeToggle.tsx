"use client";

import clsx from "clsx";
import type { EventType } from "@/lib/mock/types";

export function ModeToggle({
  value,
  onChange,
}: {
  value: EventType;
  onChange: (next: EventType) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-line/50 p-1" role="radiogroup" aria-label="Event mode">
      {(
        [
          ["trip", "A trip"],
          ["outing", "A night out"],
        ] as const
      ).map(([type, label]) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={value === type}
          onClick={() => onChange(type)}
          className={clsx(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition",
            value === type ? "bg-ink/25 text-ink" : "text-muted hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
