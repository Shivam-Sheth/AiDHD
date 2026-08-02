import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Section shell in the reference reel's format: a small uppercase label, a
 * headline set large and tight, then the body.
 *
 * There is deliberately no inverted tone. `ink` is the text token, so a
 * bg-ink band renders near-black in the light theme and near-white in the
 * dark one — the two surface tones below stay correct in both.
 */
export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  tone = "surface",
  align = "left",
  className,
}: {
  id: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  tone?: "surface" | "canvas";
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx(
        "relative scroll-mt-16 border-t border-line py-24 lg:py-32",
        tone === "surface" ? "bg-surface" : "bg-canvas",
        className,
      )}
    >
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        {(eyebrow || title || subtitle) && (
          <div className={clsx("max-w-3xl", align === "center" && "mx-auto text-center")}>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="font-hero mt-5 text-[clamp(1.9rem,4.2vw,3.25rem)] text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
