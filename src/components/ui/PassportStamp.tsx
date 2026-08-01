import clsx from "clsx";

export function PassportStamp({
  label,
  rotate = -8,
  tone = "coral",
  className,
}: {
  label: string;
  rotate?: number;
  tone?: "coral" | "violet" | "success";
  className?: string;
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet text-violet"
      : tone === "success"
        ? "border-success text-success"
        : "border-coral-dark text-coral-dark";

  return (
    <div
      className={clsx(
        "inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-center text-[9px] font-bold tracking-wider uppercase",
        toneClass,
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {label}
    </div>
  );
}
