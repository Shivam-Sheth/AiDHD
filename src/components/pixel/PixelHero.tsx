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

export function usePixelObject(autoRotate = true) {
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

  return { active, setActive, meta: PIXEL_OBJECT_META[active] };
}

export function PixelObjectPicker({
  active,
  onSelect,
}: {
  active: PixelObjectKey;
  onSelect: (key: PixelObjectKey) => void;
}) {
  return (
    <div>
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
              onClick={() => onSelect(key)}
              className={`border px-3 py-2 text-[11px] transition-all ${
                on
                  ? "shadow-[3px_3px_0_0] shadow-current/35"
                  : "border-[var(--edge)] text-[var(--inkmute)] hover:border-[var(--edgehot)] hover:text-[var(--inksoft)]"
              }`}
              style={
                on
                  ? { color: m.accent, borderColor: m.accent }
                  : undefined
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PixelSceneStage({
  activeKey,
  className,
}: {
  activeKey: PixelObjectKey;
  className?: string;
}) {
  return (
    <div className={className ?? "relative h-[46vh] min-h-[280px] w-full lg:h-[62vh]"}>
      <PixelScene activeKey={activeKey} className="absolute inset-0" />
    </div>
  );
}

/** Convenience wrapper used when picker + scene stay together (e.g. mobile stacks). */
export function PixelHero({
  className,
  autoRotate = true,
}: {
  className?: string;
  autoRotate?: boolean;
}) {
  const { active, setActive, meta } = usePixelObject(autoRotate);

  return (
    <div className={className}>
      <PixelSceneStage activeKey={active} />
      <div className="mt-4">
        <PixelObjectPicker active={active} onSelect={setActive} />
        <p
          className="mt-3 max-w-md text-sm leading-relaxed text-[var(--inksoft)]"
          style={{ borderLeft: `2px solid ${meta.accent}`, paddingLeft: 12 }}
        >
          {meta.blurb}
        </p>
      </div>
    </div>
  );
}
