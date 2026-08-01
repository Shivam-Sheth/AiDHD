"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { StepNode } from "./StepNode";

const STEPS = [
  {
    n: "1",
    title: "Start an event & invite the crew",
    description: "Pick outing or a trip, add the dates. Web, WhatsApp, or iMessage — whatever the group already uses.",
  },
  {
    n: "2",
    title: "Everyone drops budget + vibes — on their own",
    description: "No group-chat back-and-forth. Each person answers privately, whenever they get to it.",
  },
  {
    n: "3",
    title: "The agent serves 2–3 plans. You vote. It books.",
    description: "Real prices, real vendors, separate Prava spend limits per category — not one lump sum.",
  },
];

export function FlightPathSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.4"] });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative mt-16">
      <svg
        aria-hidden
        className="absolute top-8 left-0 hidden h-1 w-full text-coral-dark/50 lg:block"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M4,1 L96,1"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="1.2 3"
          strokeLinecap="round"
          fill="none"
          style={reduced ? undefined : { pathLength }}
        />
      </svg>
      <div className="grid gap-12 lg:grid-cols-3 lg:gap-6">
        {STEPS.map((s, i) => (
          <RevealOnScroll key={s.n} delay={i * 0.12}>
            <StepNode {...s} />
          </RevealOnScroll>
        ))}
      </div>
    </div>
  );
}
