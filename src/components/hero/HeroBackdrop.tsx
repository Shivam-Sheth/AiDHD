import clsx from "clsx";

export function HeroBackdrop({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "cta";
  className?: string;
}) {
  return (
    <div className={clsx("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}>
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero-wash)" }} />
      <div
        aria-hidden
        className={clsx(
          "absolute rounded-full bg-gold opacity-60 blur-[90px]",
          variant === "hero"
            ? "top-[8%] left-1/2 h-[46vw] w-[46vw] max-h-[520px] max-w-[520px] -translate-x-1/2"
            : "top-1/2 left-1/2 h-[36vw] w-[36vw] max-h-[420px] max-w-[420px] -translate-x-1/2 -translate-y-1/2",
        )}
      />
      <div
        aria-hidden
        className="absolute top-1/3 left-[15%] h-64 w-64 rounded-full bg-coral opacity-30 blur-[100px]"
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-[10%] h-72 w-72 rounded-full bg-violet opacity-30 blur-[110px]"
      />
      <div className="bg-noise absolute inset-0 opacity-[0.06]" />
    </div>
  );
}
