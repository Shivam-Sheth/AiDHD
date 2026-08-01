import clsx from "clsx";

export function GradientOrb({
  className,
  variant = "sunset",
}: {
  className?: string;
  variant?: "sunset" | "violet" | "gold";
}) {
  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none absolute rounded-full blur-3xl",
        variant === "sunset" && "bg-gradient-to-br from-coral to-gold opacity-40",
        variant === "violet" && "bg-violet opacity-30",
        variant === "gold" && "bg-gold opacity-30",
        className,
      )}
    />
  );
}
