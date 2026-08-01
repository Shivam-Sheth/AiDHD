"use client";

import { Canvas } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { PlaneRig } from "./scene/PlaneRig";
import { StageLights } from "./scene/StageLights";
import { ParticlesField } from "./scene/ParticlesField";
import { usePointerTilt } from "./usePointerTilt";
import type { DeviceTier } from "./useDeviceCapability";

export function HeroCanvas({ tier }: { tier: Exclude<DeviceTier, "off"> }) {
  const pointer = usePointerTilt();

  return (
    <Canvas
      dpr={tier === "full" ? [1, 2] : [1, 1.25]}
      camera={{ position: [0, 0.6, 6], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <ambientLight intensity={0.6} color="#ff9d6c" />
      <directionalLight position={[3, 5, 2]} intensity={1.2} color="#ffb37a" />
      <StageLights />
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.6}>
        <PlaneRig pointer={pointer} tier={tier} />
      </Float>
      <ParticlesField tier={tier} />
    </Canvas>
  );
}
