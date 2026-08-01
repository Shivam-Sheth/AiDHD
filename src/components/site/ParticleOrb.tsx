"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function ParticleForm() {
  const points = useRef<THREE.Points>(null);
  const count = 4800;

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cGold = new THREE.Color("#d4a048");
    const cCyan = new THREE.Color("#7ec8e8");
    const cWhite = new THREE.Color("#f2f4f8");

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const y = (t - 0.5) * 5.2;
      const radius =
        t < 0.16
          ? 0.12 + t * 2.4
          : t > 0.8
            ? Math.max(0.06, (1 - t) * 2.6)
            : 0.5 + Math.sin(t * Math.PI) * 0.42;
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 0.12;

      const c =
        t < 0.32 ? cGold : t > 0.68 ? cCyan.clone().lerp(cWhite, 0.4) : cCyan;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.038,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((state) => {
    if (!points.current) return;
    const t = state.clock.elapsedTime;
    points.current.rotation.y = t * 0.2;
    points.current.rotation.x = Math.sin(t * 0.22) * 0.2 + 0.4;
    points.current.rotation.z = -0.55;
    points.current.position.y = Math.sin(t * 0.55) * 0.14;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

export function ParticleOrb({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-full w-full bg-transparent ${className}`}>
      <Canvas
        camera={{ position: [0, 0.2, 6.4], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ParticleForm />
        </Suspense>
      </Canvas>
    </div>
  );
}
