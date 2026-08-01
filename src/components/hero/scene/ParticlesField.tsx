"use client";

import { Sparkles } from "@react-three/drei";

export function ParticlesField({ tier }: { tier: "full" | "lite" }) {
  return (
    <Sparkles
      count={tier === "full" ? 120 : 40}
      scale={[10, 6, 6]}
      size={2.5}
      speed={0.3}
      opacity={0.6}
      color="#ffd7a8"
      position={[0, 0.5, -1]}
    />
  );
}
