export function StepNode({
  n,
  title,
  description,
}: {
  n: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className="font-display flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-coral-dark bg-surface text-2xl font-bold text-coral-dark shadow-warm">
        {n}
      </div>
      <h3 className="font-display mt-6 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-xs text-muted">{description}</p>
    </div>
  );
}
