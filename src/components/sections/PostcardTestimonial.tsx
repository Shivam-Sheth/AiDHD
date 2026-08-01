import { PassportStamp } from "@/components/ui/PassportStamp";

export function PostcardTestimonial({
  quote,
  name,
  context,
  stamp,
  rotate = 0,
}: {
  quote: string;
  name: string;
  context: string;
  stamp: string;
  rotate?: number;
}) {
  return (
    <figure
      className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-lg shadow-ink/5 transition duration-300 hover:-translate-y-1 hover:rotate-0"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="flex items-start justify-between gap-4">
        <blockquote className="font-display text-lg leading-snug text-ink">&ldquo;{quote}&rdquo;</blockquote>
        <PassportStamp label={stamp} rotate={rotate < 0 ? 12 : -12} className="shrink-0" />
      </div>
      <figcaption className="mt-6 border-t border-dashed border-line pt-4 text-sm">
        <span className="font-semibold text-ink">{name}</span>
        <span className="text-muted"> — {context}</span>
      </figcaption>
    </figure>
  );
}
