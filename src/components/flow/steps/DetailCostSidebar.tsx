export function DetailCostSidebar({
  total,
  partySize,
  combinedBudget,
  onBook,
}: {
  total: number;
  partySize: number;
  combinedBudget: number;
  onBook: () => void;
}) {
  const pct = combinedBudget > 0 ? Math.min(100, Math.round((total / combinedBudget) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-paper p-5">
      <p className="text-[11px] font-semibold tracking-[0.15em] text-faint uppercase">
        Total for {partySize}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-ink">${total}</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line/60">
        <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-faint">{pct}% of combined budget</p>
      <button
        type="button"
        onClick={onBook}
        className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-bold text-surface transition hover:opacity-90"
      >
        Book this one
      </button>
      <p className="mt-3 text-xs text-faint">
        Separate approvals per category — no one card takes the whole hit.
      </p>
    </div>
  );
}
