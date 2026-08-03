import { createElement } from "react";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "outlineInverse";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  // Near-black primary action — the Uber/Airbnb default. No gradient, no glow.
  primary: "bg-ink text-inverse hover:bg-ink-800 active:bg-ink-900",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle",
  ghost: "text-ink hover:bg-subtle",
  // For use on dark surfaces only.
  inverse: "bg-surface text-ink hover:bg-subtle",
  outlineInverse: "border border-white/25 text-inverse hover:bg-white/10 active:bg-white/15",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return clsx(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps<T>) {
  // createElement rather than a <Tag> literal: a JSX tag typed as the whole
  // ElementType union narrows `children` to never.
  return createElement(
    (as ?? "button") as ElementType,
    { className: buttonClass({ variant, size, className }), ...rest },
    children,
  );
}
