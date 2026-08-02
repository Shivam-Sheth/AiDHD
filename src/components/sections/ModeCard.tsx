import { Plane, Ticket } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function ModeCard({
  mode,
  eyebrow,
  title,
  blurb,
  fields,
  bullets,
}: {
  mode: "outing" | "trip";
  eyebrow: string;
  title: string;
  blurb: string;
  fields: { label: string; value: string }[];
  bullets: string[];
}) {
  const Icon = mode === "trip" ? Plane : Ticket;

  return (
    <Card className="h-full p-7">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-subtle">
        <Icon className="h-4.5 w-4.5 text-ink" aria-hidden />
      </div>

      <p className="eyebrow mt-6">{eyebrow}</p>
      <h3 className="font-display mt-2 text-xl text-ink">{title}</h3>
      <p className="mt-3 leading-relaxed text-muted">{blurb}</p>

      <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-faint">{f.label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-muted">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line-strong" />
            {b}
          </li>
        ))}
      </ul>
    </Card>
  );
}
