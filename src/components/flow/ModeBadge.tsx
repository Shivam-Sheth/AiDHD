import type { EventType } from "@/lib/mock/types";

export function ModeBadge({ type }: { type: EventType }) {
  return (
    <span className="inline-flex items-center rounded-full bg-line/50 px-4 py-1.5 text-sm font-semibold text-muted">
      {type === "trip" ? "A trip" : "A night out"}
    </span>
  );
}
