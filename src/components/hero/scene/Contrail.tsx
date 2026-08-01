"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

let dotTexture: THREE.CanvasTexture | null = null;
function getDotTexture() {
  if (dotTexture) return dotTexture;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

export function Contrail({
  anchor1,
  anchor2,
  tier,
}: {
  anchor1: [number, number, number];
  anchor2: [number, number, number];
  tier: "full" | "lite";
}) {
  const count = tier === "full" ? 60 : 20;
  const points = useRef<THREE.Points>(null);
  const ages = useRef(new Float32Array(count).fill(0));
  const emitIndex = useRef(0);
  const timeSinceEmit = useRef(0);

  const { geometry, texture } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3).fill(0);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, texture: typeof document !== "undefined" ? getDotTexture() : null };
  }, [count]);

  useFrame((_state, delta) => {
    if (!points.current) return;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    timeSinceEmit.current += delta;
    const emitInterval = 0.035;
    while (timeSinceEmit.current > emitInterval) {
      timeSinceEmit.current -= emitInterval;
      const i = emitIndex.current;
      const fromLeft = i % 2 === 0;
      const [ax, ay, az] = fromLeft ? anchor1 : anchor2;
      arr[i * 3] = ax + (Math.random() - 0.5) * 0.05;
      arr[i * 3 + 1] = ay + (Math.random() - 0.5) * 0.05;
      arr[i * 3 + 2] = az;
      ages.current[i] = 0;
      emitIndex.current = (i + 1) % count;
    }

    for (let i = 0; i < count; i++) {
      ages.current[i] += delta;
      const t = ages.current[i];
      arr[i * 3 + 2] -= delta * 1.4;
      arr[i * 3 + 1] -= delta * 0.15;
      if (t > 1.8) {
        arr[i * 3] = 9999;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        map={texture}
        size={0.22}
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
