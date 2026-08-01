"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useDeviceCapability } from "./useDeviceCapability";
import { HeroFallback } from "./HeroFallback";

const HeroCanvas = dynamic(() => import("./HeroCanvas").then((m) => m.HeroCanvas), {
  ssr: false,
  loading: () => null,
});

export function HeroCanvasLoader() {
  const reducedMotion = useReducedMotion();
  const tier = useDeviceCapability();

  if (tier === null) return null;
  if (reducedMotion || tier === "off") return <HeroFallback />;

  return <HeroCanvas tier={tier} />;
}
