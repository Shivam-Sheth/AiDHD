"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function ParticleForm() {
  const points = useRef<THREE.Points>(null);
  const count = 4200;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cGold = new THREE.Color("#d4a048");
    const cCyan = new THREE.Color("#7ec8e8");
    const cWhite = new THREE.Color("#f2f4f8");

    for (let i = 0; i < count; i++) {
      const t = i / count;
      // Capsule / rocket-like point cloud
      const y = (t - 0.5) * 4.8;
      const radius =
        t < 0.18
          ? 0.15 + t * 2.2
          : t > 0.78
            ? Math.max(0.08, (1 - t) * 2.4)
            : 0.55 + Math.sin(t * Math.PI) * 0.35;
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + (Math.random() - 0.5) * 0.15;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const c =
        t < 0.35 ? cGold : t > 0.65 ? cCyan.clone().lerp(cWhite, 0.35) : cCyan;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!points.current) return;
    const t = state.clock.elapsedTime;
    points.current.rotation.y = t * 0.18;
    points.current.rotation.x = Math.sin(t * 0.22) * 0.18 + 0.35;
    points.current.position.y = Math.sin(t * 0.6) * 0.12;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        vertexColors
        transparent
        opacity={0.92}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function ParticleOrb({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#00000000"]} />
        <Suspense fallback={null}>
          <ParticleForm />
        </Suspense>
      </Canvas>
    </div>
  );
}
