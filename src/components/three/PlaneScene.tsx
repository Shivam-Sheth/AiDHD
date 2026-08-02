"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF, Center } from "@react-three/drei";
import type { Group } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ProceduralAirliner } from "./ProceduralAirliner";

/**
 * Airliner viewer. Renders `src` when a GLB is present in public/models/, and
 * the primitive-built airliner otherwise, so the scene is never empty.
 *
 * Lighting is hand-placed rather than an <Environment> preset: drei's presets
 * pull an HDR from a CDN, and the pages have to stay self-contained.
 */

function PlaneModel({ src, spin }: { src: string; spin: boolean }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(src);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (!spin) return;
    // Play whatever the author named the first clip — gear/flap rigs vary.
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.4).play();
    return () => void first?.fadeOut(0.3);
  }, [actions, spin]);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={group}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

export function PlaneScene({
  src,
  className,
}: {
  /** Path to a GLB, or null to draw the primitive-built airliner. */
  src?: string | null;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [10, 4.2, 14], fov: 38 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        frameloop={reduced ? "demand" : "always"}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 8, 4]} intensity={2.1} />
        {/* rim light, picks the fuselage out of the dark field */}
        <directionalLight position={[-7, 2, -5]} intensity={1.3} color="#ffd9bd" />

        <Suspense fallback={null}>
          {src ? (
            <PlaneModel src={src} spin={!reduced} />
          ) : (
            <Center>
              <ProceduralAirliner spin={!reduced} />
            </Center>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
