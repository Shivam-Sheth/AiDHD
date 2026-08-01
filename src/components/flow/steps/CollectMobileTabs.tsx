import clsx from "clsx";
import type { MockInvitee } from "@/lib/mock/types";
import { Avatar } from "@/components/flow/Avatar";

export function CollectMobileTabs({
  invitees,
  selectedId,
  onSelect,
}: {
  invitees: MockInvitee[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
      {invitees.map((inv) => {
        const selected = inv.id === selectedId;
        return (
          <button
            key={inv.id}
            type="button"
            onClick={() => onSelect(inv.id)}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition",
              selected ? "border-coral bg-coral/10" : "border-line bg-surface",
            )}
          >
            <Avatar name={inv.name} color={inv.colorKey} size="sm" />
            <span className="text-sm font-medium whitespace-nowrap text-ink">{inv.name}</span>
          </button>
        );
      })}
    </div>
  );
}
