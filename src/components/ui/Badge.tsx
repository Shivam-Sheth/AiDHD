import type { ReactNode } from "react";
import clsx from "clsx";

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "solid";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-subtle text-muted",
  success: "border-transparent bg-success-soft text-success",
  danger: "border-transparent bg-danger-soft text-danger",
  warning: "border-transparent bg-warning-soft text-warning",
  solid: "border-transparent bg-ink text-inverse",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children?: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
