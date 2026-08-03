import clsx from "clsx";
import type { MockInvitee } from "@/lib/mock/types";
import { Avatar } from "@/components/flow/Avatar";

export function StatusInviteeCard({
  invitee,
  onNudge,
}: {
  invitee: MockInvitee;
  onNudge: () => void;
}) {
  const responded = invitee.status === "responded";
  const tag = invitee.preferences?.structured_tags[0];

  return (
    <div
      className={clsx(
        "rounded-2xl border p-4",
        responded ? "border-line bg-surface" : "border-dashed border-line bg-canvas",
      )}
    >
      <Avatar name={invitee.name} color={invitee.colorKey} />
      <p className="mt-3 text-sm font-semibold text-ink">{invitee.name}</p>
      {responded ? (
        <>
          <p className="mt-1 text-xl font-bold tabular-nums text-ink">${invitee.budget_cap}</p>
          {tag && (
            <span className="mt-2 inline-block rounded-full bg-line/50 px-2.5 py-1 text-xs text-muted">
              {tag}
            </span>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-faint">waiting…</p>
          <button
            type="button"
            onClick={onNudge}
            className="mt-2 text-xs font-semibold text-ink underline underline-offset-2"
          >
            Nudge {invitee.name}
          </button>
        </>
      )}
    </div>
  );
}
