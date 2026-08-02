import type { PackageComponent } from "@/lib/mock/types";

export function DetailDayByDay({ days }: { days: PackageComponent[] }) {
  if (!days.length) return null;

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-4">
      <p className="text-sm font-bold text-ink">Day by day</p>
      <div className="mt-2 space-y-1.5">
        {days.map((d, i) => {
          const [label, ...rest] = d.details.split(" — ");
          const desc = rest.join(" — ");
          return (
            <p key={i} className="text-sm text-muted">
              <span className="font-semibold text-ink">{label}</span>
              {desc ? ` — ${desc}` : ""}
            </p>
          );
        })}
      </div>
    </div>
  );
}
