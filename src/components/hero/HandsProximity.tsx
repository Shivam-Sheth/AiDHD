"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Gap (in scene units, per hand) when the pointer is far from the CTA. */
const MAX_SHIFT = 115;
/** Per-frame easing toward the target — low enough to feel like drift, not snap. */
const EASE = 0.11;

/**
 * Drives `--hand-shift`: the hands close on the contact point as the pointer
 * nears the "Join us" CTA, and drift apart as it moves away.
 *
 * The value is written to a CSS custom property on the wrapper rather than
 * held in React state — this updates every frame, and re-rendering the scene
 * (hundreds of mesh paths) at 60fps would be far too expensive. The SVG reads
 * the property directly, so the whole animation stays off the React path.
 */
export function HandsProximity({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef(MAX_SHIFT);
  const current = useRef(MAX_SHIFT);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    let frame = 0;

    function onMove(e: PointerEvent) {
      const r = el!.getBoundingClientRect();
      // The CTA is pinned to the container centre — see CONTACT in HandsScene.
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      const reach = Math.max(240, Math.min(r.width, r.height) * 0.75);
      target.current = Math.min(1, dist / reach) * MAX_SHIFT;
    }

    function onLeave() {
      target.current = MAX_SHIFT;
    }

    const tick = () => {
      current.current += (target.current - current.current) * EASE;
      el.style.setProperty("--hand-shift", `${current.current.toFixed(2)}px`);
      frame = requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
