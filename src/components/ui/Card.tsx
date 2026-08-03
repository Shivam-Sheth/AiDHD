import { createElement } from "react";
import type { ElementType, ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  interactive = false,
  elevated = false,
  as,
}: {
  children?: ReactNode;
  className?: string;
  /** Adds hover elevation. Only for cards that are themselves clickable. */
  interactive?: boolean;
  elevated?: boolean;
  as?: ElementType;
}) {
  // createElement rather than a <Tag> literal: a JSX tag typed as the whole
  // ElementType union narrows `children` to never.
  return createElement(
    as ?? "div",
    {
      className: clsx(
        "rounded-xl border border-line bg-surface",
        elevated && "shadow-card",
        interactive && "transition-shadow duration-200 hover:shadow-lifted",
        className,
      ),
    },
    children,
  );
}

export function CardHeader({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={clsx("border-b border-line px-5 py-4", className)}>{children}</div>;
}

export function CardBody({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={clsx("px-5 py-4", className)}>{children}</div>;
}
