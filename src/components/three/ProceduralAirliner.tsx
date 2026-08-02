"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

/**
 * A twin-engine widebody built from primitives, laid out along +X (nose) / -X
 * (tail).
 *
 * This exists because the referenced Sketchfab model is view-only (its author
 * sells the file on CGTrader) and Sketchfab's download API is authenticated, so
 * there is no way to fetch it here. Drop a real `boeing-777-300.glb` into
 * `public/models/` and PlaneScene uses that instead — see model-assets.ts.
 */

const BODY = "#dcdee2";
const TRIM = "#2b2f36";
const ACCENT = "#3ddc97";

const SWEEP = 0.42; // wing sweep, radians

/**
 * Sweep has to be applied at the wing root, so the rotation goes on the group
 * and the slab is offset along the span inside it. Rotating the mesh itself
 * pivots about its centre and detaches the wing from the fuselage.
 */
function Wing({ side }: { side: 1 | -1 }) {
  return (
    <group position={[-0.35, -0.18, 0]} rotation={[0, -side * SWEEP, 0]}>
      <mesh position={[0, 0, side * 2.5]}>
        <boxGeometry args={[2.3, 0.1, 5.0]} />
        <meshStandardMaterial color={BODY} metalness={0.35} roughness={0.42} />
      </mesh>
      {/* winglet */}
      <mesh position={[-0.35, 0.28, side * 4.95]} rotation={[side * 0.35, 0, 0]}>
        <boxGeometry args={[1.0, 0.72, 0.09]} />
        <meshStandardMaterial color={ACCENT} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* engine, slung forward of and below the leading edge */}
      <group position={[0.95, -0.52, side * 2.05]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.34, 1.7, 24]} />
          <meshStandardMaterial color={TRIM} metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[0.87, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.33, 0.14, 24]} />
          <meshStandardMaterial color={ACCENT} metalness={0.45} roughness={0.45} />
        </mesh>
        {/* pylon up to the wing */}
        <mesh position={[-0.5, 0.36, 0]}>
          <boxGeometry args={[0.75, 0.5, 0.13]} />
          <meshStandardMaterial color={BODY} roughness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

export function ProceduralAirliner({ spin = true }: { spin?: boolean }) {
  const group = useRef<Group>(null);
  const windows = useMemo(() => Array.from({ length: 30 }, (_, i) => -3.2 + i * 0.24), []);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (spin) group.current.rotation.y += delta * 0.25;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
  });

  return (
    <group ref={group}>
      {/* fuselage */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 8.6, 32]} />
        <meshStandardMaterial color={BODY} metalness={0.3} roughness={0.4} />
      </mesh>
      {/* nose */}
      <mesh position={[4.62, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.6, 1.65, 32]} />
        <meshStandardMaterial color={BODY} metalness={0.3} roughness={0.4} />
      </mesh>
      {/* tail cone, rising the way a widebody's rear fuselage does */}
      <mesh position={[-4.75, 0.3, 0]} rotation={[0, 0, Math.PI / 2 + 0.13]}>
        <coneGeometry args={[0.6, 2.3, 32]} />
        <meshStandardMaterial color={BODY} metalness={0.3} roughness={0.4} />
      </mesh>

      {/* cockpit glass */}
      <mesh position={[4.0, 0.26, 0]} scale={[1.5, 0.7, 1]}>
        <sphereGeometry args={[0.3, 20, 16]} />
        <meshStandardMaterial color={TRIM} metalness={0.85} roughness={0.12} />
      </mesh>

      {/* cabin windows + cheat-line */}
      {windows.map((x) => (
        <mesh key={x} position={[x, 0.22, 0.585]}>
          <boxGeometry args={[0.09, 0.07, 0.05]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      <mesh position={[0.1, -0.06, 0.585]}>
        <boxGeometry args={[8.0, 0.09, 0.05]} />
        <meshStandardMaterial color={ACCENT} roughness={0.5} />
      </mesh>

      <Wing side={1} />
      <Wing side={-1} />

      {/* vertical stabiliser — swept back, so the top edge trails the root */}
      <mesh position={[-4.45, 1.2, 0]} rotation={[0, 0, 0.38]}>
        <boxGeometry args={[1.5, 2.1, 0.11]} />
        <meshStandardMaterial color={BODY} metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[-4.72, 1.95, 0]} rotation={[0, 0, 0.38]}>
        <boxGeometry args={[0.85, 0.7, 0.13]} />
        <meshStandardMaterial color={ACCENT} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* horizontal stabilisers */}
      {([1, -1] as const).map((s) => (
        <group key={s} position={[-4.5, 0.42, 0]} rotation={[0, -s * 0.5, 0]}>
          <mesh position={[0, 0, s * 1.15]}>
            <boxGeometry args={[1.35, 0.09, 2.3]} />
            <meshStandardMaterial color={BODY} metalness={0.3} roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
