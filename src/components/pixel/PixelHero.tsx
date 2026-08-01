"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  PIXEL_OBJECT_META,
  PIXEL_OBJECT_ORDER,
  type PixelObjectKey,
} from "@/lib/pixel/voxels";

const PixelScene = dynamic(
  () => import("./PixelScene").then((m) => m.PixelScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <p className="font-display text-[0.55rem] tracking-widest text-[var(--inkmute)]">
          Loading<span className="blink">_</span>
        </p>
      </div>
    ),
  },
);

export function PixelHero({
  className,
  autoRotate = true,
}: {
  className?: string;
  autoRotate?: boolean;
}) {
  const [active, setActive] = useState<PixelObjectKey>("plane");

  useEffect(() => {
    if (!autoRotate) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        const i = PIXEL_OBJECT_ORDER.indexOf(cur);
        return PIXEL_OBJECT_ORDER[(i + 1) % PIXEL_OBJECT_ORDER.length];
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [autoRotate]);

  const meta = PIXEL_OBJECT_META[active];

  return (
    <div className={className}>
      <div className="relative h-[46vh] min-h-[280px] w-full lg:h-[62vh]">
        <PixelScene activeKey={active} className="absolute inset-0" />
      </div>
      <div className="mt-4">
        <p className="label mb-3 text-[var(--inkmute)]">Select object</p>
        <div className="flex flex-wrap gap-2">
          {PIXEL_OBJECT_ORDER.map((key) => {
            const m = PIXEL_OBJECT_META[key];
            const on = key === active;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setActive(key)}
                className={`border px-3 py-2 text-[11px] transition-all ${
                  on
                    ? "border-[var(--cyan)] text-[var(--cyan)] shadow-[3px_3px_0_0] shadow-[var(--cyan)]/35"
                    : "border-[var(--edge)] text-[var(--inkmute)] hover:border-[var(--edgehot)] hover:text-[var(--inksoft)]"
                }`}
                style={on ? { color: m.accent, borderColor: m.accent } : undefined}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p
          className="mt-3 max-w-md text-sm leading-relaxed text-[var(--inksoft)] transition-colors"
          style={{ borderLeft: `2px solid ${meta.accent}`, paddingLeft: 12 }}
        >
          {meta.blurb}
        </p>
      </div>
    </div>
  );
}
