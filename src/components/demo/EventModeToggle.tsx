import clsx from "clsx";
import { EVENT_ID, TRIP_EVENT_ID } from "@/lib/client/api";

export function EventModeToggle({
  eventId,
  onChange,
}: {
  eventId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(EVENT_ID)}
        className={clsx(
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          eventId === EVENT_ID
            ? "bg-gradient-to-r from-coral to-gold text-dusk-950 shadow-warm"
            : "bg-line/60 text-muted hover:bg-line",
        )}
      >
        Outing demo
      </button>
      <button
        type="button"
        onClick={() => onChange(TRIP_EVENT_ID)}
        className={clsx(
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          eventId === TRIP_EVENT_ID
            ? "bg-gradient-to-r from-coral to-gold text-dusk-950 shadow-warm"
            : "bg-line/60 text-muted hover:bg-line",
        )}
      >
        Travel demo (Miami)
      </button>
    </div>
  );
}
