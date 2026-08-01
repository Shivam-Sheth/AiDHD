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
        <p className="text-sm text-[var(--inkmute)]">Loading journey…</p>
      </div>
    ),
  },
);

const JOURNEY_COPY: Record<
  PixelObjectKey,
  { step: string; route: string }
> = {
  plane: { step: "01 · Fly", route: "ORD → MIA · live Duffel fares" },
  hotel: { step: "02 · Stay", route: "South Beach · guest-ranked stays" },
  ticket: { step: "03 · Experience", route: "Shows & nights · Ticketmaster" },
  dining: { step: "04 · Dine", route: "Tables that clear every budget" },
};

export function usePixelObject(autoRotate = true) {
  const [active, setActive] = useState<PixelObjectKey>("plane");

  useEffect(() => {
    if (!autoRotate) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        const i = PIXEL_OBJECT_ORDER.indexOf(cur);
        return PIXEL_OBJECT_ORDER[(i + 1) % PIXEL_OBJECT_ORDER.length];
      });
    }, 3800);
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
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.14em] text-[var(--inkmute)] uppercase">
          Trip cycle
        </p>
        <p className="text-[11px] text-[var(--inkmute)]">
          {JOURNEY_COPY[active].step}
        </p>
      </div>
      <div className="relative flex flex-wrap gap-2">
        {PIXEL_OBJECT_ORDER.map((key, i) => {
          const m = PIXEL_OBJECT_META[key];
          const on = key === active;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(key)}
              className={`relative border px-3.5 py-2 text-sm transition-all ${
                on
                  ? "border-[var(--ink)]/25 bg-[var(--panel)] text-[var(--ink)] shadow-[0_8px_24px_-16px_var(--accent-shadow)]"
                  : "border-transparent text-[var(--inkmute)] hover:text-[var(--inksoft)]"
              }`}
            >
              <span className="mr-1.5 text-[10px] text-[var(--inkmute)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {m.label}
              {on && (
                <span
                  className="absolute inset-x-3 -bottom-px h-0.5"
                  style={{ background: m.accent }}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-[var(--inksoft)]">
        <span className="font-medium text-[var(--ink)]">
          {JOURNEY_COPY[active].route}
        </span>
        <span className="text-[var(--inkmute)]"> — {PIXEL_OBJECT_META[active].blurb}</span>
      </p>
    </div>
  );
}

export function PixelSceneStage({
  activeKey,
  className,
  journey = true,
}: {
  activeKey: PixelObjectKey;
  className?: string;
  journey?: boolean;
}) {
  return (
    <div
      className={
        className ??
        "relative h-[48vh] min-h-[300px] w-full overflow-hidden rounded-2xl border border-[var(--edge)] bg-[var(--panel)]/30 lg:h-[66vh]"
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--atmosphere-a),transparent_65%)]" />
      <PixelScene
        activeKey={activeKey}
        journey={journey}
        className="absolute inset-0"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between gap-2 px-4 py-3 text-[10px] tracking-[0.16em] text-[var(--inkmute)] uppercase">
        {PIXEL_OBJECT_ORDER.map((key) => (
          <span
            key={key}
            className={key === activeKey ? "text-[var(--ink)]" : "opacity-50"}
          >
            {PIXEL_OBJECT_META[key].label}
          </span>
        ))}
      </div>
    </div>
  );
}
