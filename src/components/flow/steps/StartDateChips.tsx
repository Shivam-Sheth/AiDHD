"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function formatChip(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const INITIAL_OFFSETS = [14, 15, 16, 17];
const MORE_OFFSETS = [21, 22, 28, 29];

export function StartDateChips({
  selected,
  onChange,
  multiple = true,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
  multiple?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const dates = useMemo(() => {
    const offsets = expanded ? [...INITIAL_OFFSETS, ...MORE_OFFSETS] : INITIAL_OFFSETS;
    return offsets.map(isoDate);
  }, [expanded]);

  function toggle(iso: string) {
    if (multiple) {
      onChange(
        selected.includes(iso) ? selected.filter((d) => d !== iso) : [...selected, iso].sort(),
      );
    } else {
      onChange(selected.includes(iso) ? [] : [iso]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {dates.map((iso) => {
        const active = selected.includes(iso);
        return (
          <button
            key={iso}
            type="button"
            onClick={() => toggle(iso)}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-3.5 py-1.5 font-mono text-sm transition",
              active ? "bg-ink text-surface" : "bg-line/50 text-muted hover:bg-line",
            )}
          >
            {formatChip(iso)}
          </button>
        );
      })}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-full bg-line/50 px-3.5 py-1.5 font-mono text-sm text-muted hover:bg-line"
        >
          + more
        </button>
      )}
    </div>
  );
}
