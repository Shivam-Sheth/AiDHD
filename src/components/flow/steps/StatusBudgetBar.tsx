export function StatusBudgetBar({
  total,
  pendingNames,
  onViewPackages,
}: {
  total: number;
  pendingNames: string[];
  onViewPackages: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-ink p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.15em] text-surface/60 uppercase">
          Combined budget so far
        </p>
        <p className="mt-1 text-lg font-bold text-surface">
          ${total} so far
          {pendingNames.length ? ` · ${pendingNames.join(", ")} pending` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onViewPackages}
        className="shrink-0 rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-ink transition hover:brightness-105"
      >
        Packages update automatically
      </button>
    </div>
  );
}
