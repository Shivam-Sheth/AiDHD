import clsx from "clsx";
import type { PackageData } from "@/lib/types-client";

export function PlanCard({
  pkg,
  selected,
  disabled,
  onSelect,
}: {
  pkg: PackageData;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "w-full rounded-xl border p-4 text-left transition disabled:cursor-default",
        selected
          ? "border-ink bg-subtle shadow-card"
          : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-ink">{pkg.label}</div>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{pkg.rationale}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pkg.components.map((c, i) => (
              <span key={i} className="rounded-md bg-surface px-2 py-0.5 text-[11px] text-muted">
                {c.vendor}
                {c.vendor_verified ? " · Senso verified" : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-semibold tabular-nums text-ink">${pkg.total_cost}</div>
          <div className="text-xs tabular-nums text-faint">${pkg.cost_per_person}/person</div>
        </div>
      </div>
    </button>
  );
}
