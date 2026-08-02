import clsx from "clsx";
import type { MockInvitee } from "@/lib/mock/types";
import { Avatar } from "@/components/flow/Avatar";

const CHANNEL_LABEL: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
};

export function statusLabel(inv: MockInvitee, isSelected: boolean): string {
  if (isSelected && inv.agentTyping) return "typing now";
  if (inv.role === "organizer") return "organizer";
  if (inv.status === "responded" || inv.messages.some((m) => m.role === "user")) {
    return `via ${CHANNEL_LABEL[inv.channel] ?? inv.channel}`;
  }
  return "not yet";
}

export function hasStarted(inv: MockInvitee): boolean {
  return inv.role === "organizer" || inv.status === "responded" || inv.messages.some((m) => m.role === "user");
}

export function CollectSidebar({
  invitees,
  selectedId,
  onSelect,
}: {
  invitees: MockInvitee[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-56 shrink-0 border-r border-line pr-4">
      <p className="text-[11px] font-semibold tracking-[0.15em] text-faint uppercase">Invitees</p>
      <div className="mt-3 space-y-1">
        {invitees.map((inv) => {
          const selected = inv.id === selectedId;
          const label = statusLabel(inv, selected);
          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => onSelect(inv.id)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition",
                selected ? "border-ink bg-ink/5" : "border-transparent hover:bg-canvas",
              )}
            >
              <Avatar name={inv.name} color={inv.colorKey} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{inv.name}</span>
                <span
                  className={clsx(
                    "block truncate text-xs",
                    label === "typing now" ? "text-ink" : "text-faint",
                  )}
                >
                  {label}
                </span>
              </span>
              {hasStarted(inv) && <span className="h-2 w-2 shrink-0 rounded-full bg-success" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
