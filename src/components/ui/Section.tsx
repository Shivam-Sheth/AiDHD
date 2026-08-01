import type { ReactNode } from "react";
import clsx from "clsx";

export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  tone = "light",
  className,
}: {
  id: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  tone?: "light" | "paper" | "dusk";
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx(
        "relative scroll-mt-20 py-20 lg:py-28",
        tone === "light" && "bg-surface",
        tone === "paper" && "bg-paper",
        tone === "dusk" && "bg-dusk-950 text-dusk-ink",
        className,
      )}
    >
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        {(eyebrow || title || subtitle) && (
          <div className="mx-auto max-w-2xl text-center">
            {eyebrow && (
              <p
                className={clsx(
                  "text-xs font-semibold tracking-[0.2em] uppercase",
                  tone === "dusk" ? "text-gold" : "text-coral-dark",
                )}
              >
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={clsx(
                  "mt-4 text-lg leading-relaxed",
                  tone === "dusk" ? "text-dusk-muted" : "text-muted",
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
