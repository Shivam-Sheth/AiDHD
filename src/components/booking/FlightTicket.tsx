"use client";

import { Plane } from "lucide-react";
import clsx from "clsx";

export type FlightTicketData = {
  id: string;
  airline: string;
  airline_logo_url?: string | null;
  airline_iata?: string | null;
  flight_number?: string;
  duration?: string;
  stops?: number;
  from: string;
  from_city?: string;
  to: string;
  to_city?: string;
  depart: string;
  arrive: string;
  cabin: string;
  price_per_person: number;
  source?: string;
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || iso;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function FlightTicket({
  f,
  highlighted,
  onMouseEnter,
  onMouseLeave,
}: {
  f: FlightTicketData;
  highlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const stopsLabel =
    f.stops == null ? null : f.stops === 0 ? "Nonstop" : `${f.stops} stop`;

  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        "group flex overflow-hidden rounded-2xl border bg-surface shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lifted",
        highlighted ? "border-ink" : "border-line",
      )}
    >
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas">
              {f.airline_logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.airline_logo_url}
                  alt=""
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span className="font-display text-xs font-bold text-ink-800">
                  {(f.airline_iata || f.airline).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-ink">
                {f.airline}
              </p>
              <p className="text-[11px] text-muted">
                {[f.flight_number, f.cabin, stopsLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tabular-nums text-ink">
              ${Math.round(f.price_per_person)}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              per person
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              {f.from_city || "Depart"}
            </p>
            <p className="font-display text-3xl font-bold tracking-tight text-ink">
              {f.from}
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink">
              {fmtTime(f.depart)}
            </p>
            <p className="text-[11px] text-muted">{fmtDate(f.depart)}</p>
          </div>

          <div className="flex flex-col items-center px-2 pb-6">
            <div className="flex w-full min-w-[4.5rem] items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" />
              <span className="h-px flex-1 bg-line" />
              <Plane className="h-3.5 w-3.5 text-ink-800" aria-hidden />
            </div>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {f.duration || "Direct"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              {f.to_city || "Arrive"}
            </p>
            <p className="font-display text-3xl font-bold tracking-tight text-ink">
              {f.to}
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink">
              {fmtTime(f.arrive)}
            </p>
            <p className="text-[11px] text-muted">{fmtDate(f.arrive)}</p>
          </div>
        </div>
      </div>

      <div className="flex w-[4.25rem] shrink-0 flex-col items-center justify-between border-l border-dashed border-line bg-ink-800 px-2 py-5 text-inverse sm:w-20">
        <Plane className="h-4 w-4" aria-hidden />
        <p
          className="text-[9px] font-semibold tracking-[0.28em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          Boarding pass
        </p>
        <div
          aria-hidden
          className="h-12 w-3 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, currentColor 0 2px, transparent 2px 5px)",
          }}
        />
      </div>
    </article>
  );
}
