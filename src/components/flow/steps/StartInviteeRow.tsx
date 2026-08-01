import { Plus } from "lucide-react";
import type { Persona } from "@/lib/mock/personas";
import { Avatar } from "@/components/flow/Avatar";

export function StartInviteeRow({
  organizer,
  invitees,
  canAdd,
  onAdd,
}: {
  organizer: Persona;
  invitees: Persona[];
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Avatar name={organizer.name} color={organizer.colorKey} />
      {invitees.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.colorKey} />
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add invitee"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-line text-faint transition hover:border-coral-dark/40 hover:text-coral-dark"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
