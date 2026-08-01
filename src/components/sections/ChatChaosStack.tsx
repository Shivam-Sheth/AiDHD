"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import clsx from "clsx";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const MESSAGES = [
  { text: "wait what's everyone's budget??", from: "left" as const },
  { text: "can we do the 14th instead", from: "right" as const },
  { text: "i said Friday not Sat", from: "left" as const },
  { text: "who's fronting the tickets", from: "right" as const },
  { text: "can we NOT do sushi again", from: "left" as const },
  { text: "so... is this happening or not", from: "right" as const },
];

const CALM_SUMMARY = {
  title: "Brooklyn Steel + dinner",
  meta: "3 of 3 responded · $150/person avg",
};

function Bubble({
  text,
  from,
  index,
  progress,
}: {
  text: string;
  from: "left" | "right";
  index: number;
  progress: MotionValue<number>;
}) {
  const scatterX = (index % 2 === 0 ? -1 : 1) * (60 + index * 22);
  const scatterY = ((index * 47) % 200) - 90;
  const scatterRotate = (index % 2 === 0 ? -1 : 1) * (7 + ((index * 5) % 14));
  const settledY = index * 46 - (MESSAGES.length * 46) / 2;

  const x = useTransform(progress, [0, 0.55], [scatterX, 0]);
  const y = useTransform(progress, [0, 0.55], [scatterY, settledY]);
  const rotate = useTransform(progress, [0, 0.55], [scatterRotate, 0]);
  const opacity = useTransform(progress, [0, 0.15, 0.5, 0.72], [0, 1, 1, 0]);

  return (
    <motion.div
      style={{ x, y, rotate, opacity }}
      className={clsx(
        "absolute top-1/2 left-1/2 w-max max-w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg",
        from === "left"
          ? "origin-left bg-surface text-ink"
          : "origin-right bg-gradient-to-br from-coral to-gold text-dusk-950",
      )}
    >
      {text}
    </motion.div>
  );
}

function CalmCard({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.68, 0.92], [0, 1]);
  const scale = useTransform(progress, [0.68, 0.92], [0.92, 1]);

  return (
    <motion.div
      style={{ opacity, scale }}
      className="ticket-stub absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 text-center shadow-warm"
    >
      <p className="text-xs font-semibold tracking-[0.2em] text-success uppercase">Resolved</p>
      <p className="font-display mt-2 text-lg font-semibold text-ink">{CALM_SUMMARY.title}</p>
      <p className="mt-1 text-sm text-muted">{CALM_SUMMARY.meta}</p>
    </motion.div>
  );
}

function StaticChaosToCalm() {
  return (
    <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        {MESSAGES.map((m, i) => (
          <div
            key={i}
            className={clsx(
              "w-max max-w-[220px] rounded-2xl px-4 py-2.5 text-sm font-medium shadow",
              m.from === "left" ? "bg-surface text-ink" : "ml-auto bg-gradient-to-br from-coral to-gold text-dusk-950",
            )}
            style={{ transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)` }}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="ticket-stub flex flex-col justify-center rounded-2xl border border-line bg-surface p-6 text-center shadow-warm">
        <p className="text-xs font-semibold tracking-[0.2em] text-success uppercase">Resolved</p>
        <p className="font-display mt-2 text-lg font-semibold text-ink">{CALM_SUMMARY.title}</p>
        <p className="mt-1 text-sm text-muted">{CALM_SUMMARY.meta}</p>
      </div>
    </div>
  );
}

export function ChatChaosStack() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  if (reduced) return <StaticChaosToCalm />;

  return (
    <div ref={ref} className="relative h-[220vh] overflow-x-hidden">
      <div className="sticky top-28 mx-auto h-[420px] max-w-md">
        {MESSAGES.map((m, i) => (
          <Bubble key={i} text={m.text} from={m.from} index={i} progress={scrollYProgress} />
        ))}
        <CalmCard progress={scrollYProgress} />
      </div>
    </div>
  );
}
