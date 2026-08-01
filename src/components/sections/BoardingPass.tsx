import { Plane, Ticket } from "lucide-react";
import clsx from "clsx";

export function BoardingPass({
  mode,
  eyebrow,
  title,
  blurb,
  fields,
  bullets,
  rotate = 0,
}: {
  mode: "outing" | "trip";
  eyebrow: string;
  title: string;
  blurb: string;
  fields: { label: string; value: string }[];
  bullets: string[];
  rotate?: number;
}) {
  const Icon = mode === "trip" ? Plane : Ticket;

  return (
    <article
      className="ticket-stub flex overflow-hidden rounded-2xl border border-line bg-surface shadow-warm transition duration-300 hover:rotate-0 hover:shadow-[0_30px_70px_-25px_rgb(255,107,91,0.45)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="flex-1 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-coral-dark uppercase">{eyebrow}</p>
        <h3 className="font-display mt-2 text-2xl font-semibold text-ink">{title}</h3>
        <p className="mt-3 leading-relaxed text-muted">{blurb}</p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-faint uppercase">{f.label}</p>
              <p className="font-display mt-1 text-sm font-semibold text-ink">{f.value}</p>
            </div>
          ))}
        </div>

        <ul className="mt-5 space-y-1.5 text-sm text-muted">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral-dark" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div
        className={clsx(
          "tear-line flex w-20 shrink-0 flex-col items-center justify-between border-l border-dashed border-line px-2 py-6 sm:w-24",
          mode === "trip" ? "bg-ocean text-dusk-ink" : "bg-dusk-950 text-dusk-ink",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <p
          className="text-[10px] font-semibold tracking-[0.3em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          AiDHD · {mode === "trip" ? "Trip" : "Outing"}
        </p>
        <div
          aria-hidden
          className="h-16 w-4"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, currentColor 0 3px, transparent 3px 6px)",
            opacity: 0.5,
          }}
        />
      </div>
    </article>
  );
}
