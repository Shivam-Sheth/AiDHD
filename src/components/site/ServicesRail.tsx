"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  PIXEL_OBJECT_META,
  PIXEL_OBJECT_ORDER,
  type PixelObjectKey,
} from "@/lib/pixel/voxels";

const PixelScene = dynamic(
  () =>
    import("@/components/pixel/PixelScene").then((m) => m.PixelScene),
  { ssr: false },
);

const RAIL: {
  key: PixelObjectKey;
  title: string;
  tag: string;
  copy: string;
}[] = [
  {
    key: "plane",
    title: "Flights",
    tag: "01 · AIR",
    copy: "Live Duffel inventory ranked for the group — cabin, timing, and split cost.",
  },
  {
    key: "hotel",
    title: "Hotels",
    tag: "02 · STAY",
    copy: "Stays that clear every budget cap, with trust scores before you pick.",
  },
  {
    key: "dining",
    title: "Restaurants",
    tag: "03 · TABLE",
    copy: "Pre-show bites or destination dinners that fit the night and the spend.",
  },
  {
    key: "ticket",
    title: "Clubs",
    tag: "04 · NIGHT",
    copy: "Concerts, clubs, and shows — Ticketmaster seats with scoped Prava spend.",
  },
];

/** Horizontal-scroll / zoom services strip — Noomo-style overlapping 3D + type. */
export function ServicesRail() {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      const i = Math.round(el.scrollLeft / w);
      setActive(Math.max(0, Math.min(RAIL.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="about" className="relative border-t border-[var(--edge)]">
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-5 pt-16 pb-8 lg:px-10">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--inkmute)] uppercase">
            About · What we book
          </p>
          <h2 className="font-display mt-3 text-4xl font-bold tracking-tight text-[var(--ink)] uppercase sm:text-5xl">
            The whole night
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--inksoft)]">
            Scroll the stack — flights, hotels, restaurants, clubs — each with a
            live 3D cue and a Prava-scoped pay lane.
          </p>
        </div>
        <div className="hidden font-mono text-[10px] tracking-[0.18em] text-[var(--inkmute)] uppercase sm:block">
          {PIXEL_OBJECT_ORDER.map((k, i) => (
            <span key={k} className="mr-3">
              {i === active ? `[ ${PIXEL_OBJECT_META[k].label} ]` : "+"}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={scroller}
        className="services-rail flex snap-x snap-mandatory overflow-x-auto"
      >
        {RAIL.map((item, i) => {
          const on = i === active;
          return (
            <article
              key={item.key}
              className="relative h-[78vh] min-h-[520px] w-full shrink-0 snap-center"
            >
              {/* Giant title behind 3D — Noomo overlap format */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <h3
                  className={`font-display select-none text-[18vw] font-black leading-none tracking-tight text-[var(--ink)] uppercase transition-all duration-500 ${
                    on ? "scale-100 opacity-[0.14]" : "scale-90 opacity-[0.06]"
                  }`}
                >
                  {item.title}
                </h3>
              </div>

              <div
                className={`absolute inset-0 transition-transform duration-500 ${
                  on ? "scale-100" : "scale-[0.92]"
                }`}
              >
                <PixelScene
                  activeKey={item.key}
                  journey={false}
                  className="absolute inset-0"
                />
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/80 to-transparent px-5 pb-10 pt-28 lg:px-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--coral)] uppercase">
                      {item.tag}
                    </p>
                    <h4 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--ink)] uppercase sm:text-4xl">
                      {item.title}
                    </h4>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--inksoft)]">
                      {item.copy}
                    </p>
                  </div>
                  <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--inkmute)] uppercase">
                    {String(i + 1).padStart(2, "0")} /{" "}
                    {String(RAIL.length).padStart(2, "0")}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-auto flex max-w-7xl gap-2 px-5 py-6 lg:px-10">
        {RAIL.map((item, i) => (
          <button
            key={item.key}
            type="button"
            aria-label={`Show ${item.title}`}
            onClick={() => {
              const el = scroller.current;
              if (!el) return;
              el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
            }}
            className={`h-1 flex-1 transition-colors ${
              i === active ? "bg-[var(--ink)]" : "bg-[var(--edgehot)]"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
