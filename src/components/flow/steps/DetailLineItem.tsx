import clsx from "clsx";
import type { PackageComponent } from "@/lib/mock/types";

// Separated by lightness, not hue — see AVATAR_STYLES for the same approach.
const SWATCH: Record<string, string> = {
  flight: "bg-ink",
  hotel: "bg-ink-700",
  dining: "bg-line-strong",
  ticket: "bg-line",
};

function priceLabel(c: PackageComponent): string {
  if (c.type === "hotel") return `$${c.cost}/night`;
  return `$${c.cost}pp`;
}

export function DetailLineItem({ component }: { component: PackageComponent }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={clsx("h-9 w-9 shrink-0 rounded-lg", SWATCH[component.type] ?? "bg-line")}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{component.vendor}</p>
          <p className="truncate text-xs text-muted">{component.details}</p>
        </div>
      </div>
      <p className="shrink-0 font-mono text-sm font-semibold text-ink">{priceLabel(component)}</p>
    </div>
  );
}
