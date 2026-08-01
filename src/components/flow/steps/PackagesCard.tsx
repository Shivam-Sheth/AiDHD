import clsx from "clsx";
import type { Package } from "@/lib/mock/types";

export function PackagesCard({
  pkg,
  isMostVoted,
  onViewDetails,
}: {
  pkg: Package;
  isMostVoted: boolean;
  onViewDetails: () => void;
}) {
  return (
    <div
      className={clsx(
        "relative flex flex-col rounded-2xl border bg-surface p-5",
        isMostVoted ? "border-coral shadow-warm" : "border-line",
      )}
    >
      {isMostVoted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-1 text-[10px] font-bold tracking-wide text-ink uppercase">
          Most voted
        </span>
      )}
      <p className="text-xs font-semibold tracking-wide text-success uppercase">
        {Math.round(pkg.fit_score * 100)}% fit
      </p>
      <h3 className="mt-2 text-lg font-bold text-ink">{pkg.label}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{pkg.rationale}</p>
      <p className="mt-4 text-2xl font-bold tabular-nums text-ink">${pkg.total_cost}</p>
      <p className="text-sm tabular-nums text-faint">${pkg.cost_per_person} per person</p>
      <button
        type="button"
        onClick={onViewDetails}
        className={clsx(
          "mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition",
          isMostVoted ? "bg-ink text-surface" : "border border-ink text-ink hover:bg-paper",
        )}
      >
        View details
      </button>
    </div>
  );
}
