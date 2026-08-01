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
        <p className="text-sm text-[var(--inkmute)]">Loading models…</p>
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
    }, 4800);
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
            className={`border px-3.5 py-1.5 text-sm transition-colors ${
              on
                ? "border-white/30 bg-white/8 text-[var(--ink)]"
                : "border-transparent text-[var(--inkmute)] hover:text-[var(--inksoft)]"
            }`}
            style={on ? { boxShadow: `inset 0 -2px 0 0 ${m.accent}` } : undefined}
          >
            {m.label}
          </button>
        );
      })}
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
    <div
      className={
        className ?? "relative h-[46vh] min-h-[280px] w-full lg:h-[64vh]"
      }
    >
      <PixelScene activeKey={activeKey} className="absolute inset-0" />
    </div>
  );
}
