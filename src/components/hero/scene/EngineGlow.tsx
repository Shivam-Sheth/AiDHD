"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,220,150,1)");
  gradient.addColorStop(0.4, "rgba(255,150,90,0.6)");
  gradient.addColorStop(1, "rgba(255,107,91,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

export function EngineGlow({
  position,
  tier,
}: {
  position: [number, number, number];
  tier: "full" | "lite";
}) {
  const sprite = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => (typeof document !== "undefined" ? getGlowTexture() : null), []);

  useFrame(({ clock }) => {
    if (!sprite.current) return;
    const flicker = 0.9 + Math.sin(clock.elapsedTime * 6 + position[0]) * 0.1;
    sprite.current.scale.setScalar(0.55 * flicker);
  });

  if (!texture) return null;

  return (
    <sprite ref={sprite} position={position} scale={0.55}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
      {tier === "full" && (
        <pointLight color="#ffb37a" intensity={1.2} distance={2.5} decay={2} />
      )}
    </sprite>
  );
}
