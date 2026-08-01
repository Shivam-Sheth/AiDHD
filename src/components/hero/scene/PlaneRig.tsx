"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Contrail } from "./Contrail";
import { EngineGlow } from "./EngineGlow";

const GOLD = "#ffb347";
const CORAL = "#ff6b5b";
const HULL = "#fff7ed";
const SHADE = "#2a1640";

const REST = {
  full: { x: 3.75, y: 0.85, z: -0.3, scale: 0.8 },
  lite: { x: 1.15, y: 1.75, z: -0.2, scale: 0.42 },
};
const BASE_YAW = 0.62; // static 3/4 turn so the fuselage/wings read, not nose-on
const BASE_PITCH = -0.06;
const HALF_PI = Math.PI / 2;

export function PlaneRig({
  pointer,
  tier,
}: {
  pointer: React.RefObject<{ x: number; y: number }>;
  tier: "full" | "lite";
}) {
  const entrance = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const rest = REST[tier];

  useFrame((_state, delta) => {
    elapsed.current += delta;
    const e = entrance.current;
    const t = tilt.current;
    if (!e || !t) return;

    // entrance: settle from far/small toward resting pose
    const settled = Math.min(elapsed.current / 1.6, 1);
    const ease = 1 - Math.pow(1 - settled, 3);
    e.position.set(
      THREE.MathUtils.lerp(rest.x + 2.5, rest.x, ease),
      THREE.MathUtils.lerp(rest.y + 1, rest.y, ease),
      THREE.MathUtils.lerp(-9, rest.z, ease),
    );
    e.scale.setScalar(THREE.MathUtils.lerp(0.4, rest.scale, ease));

    // banking: pointer-driven roll/pitch on top of the static 3/4 framing
    const idle = pointer.current.x === 0 && pointer.current.y === 0;
    const targetRoll = idle ? Math.sin(elapsed.current * 0.3) * 0.1 : -pointer.current.x * 0.4;
    const targetPitch = idle ? Math.cos(elapsed.current * 0.24) * 0.05 : pointer.current.y * 0.12;

    t.rotation.z = THREE.MathUtils.damp(t.rotation.z, targetRoll, 4, delta);
    t.rotation.x = THREE.MathUtils.damp(t.rotation.x, BASE_PITCH + targetPitch, 4, delta);
    t.rotation.y = THREE.MathUtils.damp(t.rotation.y, BASE_YAW + targetRoll * 0.3, 4, delta);
  });

  return (
    <group ref={entrance} position={[rest.x + 2.5, rest.y + 1, -9]} scale={0.4}>
      <group ref={tilt} rotation={[BASE_PITCH, BASE_YAW, 0]}>
        {/* fuselage — long axis along Z, nose toward the camera */}
        <mesh rotation={[HALF_PI, 0, 0]} castShadow>
          <capsuleGeometry args={[0.34, 2.3, 4, 8]} />
          <meshStandardMaterial color={HULL} flatShading roughness={0.4} metalness={0.1} />
        </mesh>

        {/* nose cone */}
        <mesh position={[0, 0, 1.5]} rotation={[HALF_PI, 0, 0]}>
          <coneGeometry args={[0.33, 0.5, 8]} />
          <meshStandardMaterial color={HULL} flatShading roughness={0.4} metalness={0.1} />
        </mesh>

        {/* livery stripes */}
        <mesh position={[0, -0.02, 0.1]}>
          <boxGeometry args={[0.72, 0.12, 2.9]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
        <mesh position={[0, -0.18, 0.15]}>
          <boxGeometry args={[0.62, 0.05, 2.4]} />
          <meshBasicMaterial color={CORAL} />
        </mesh>

        {/* wings */}
        <mesh position={[0, -0.08, -0.1]} rotation={[0, 0, 0.04]}>
          <boxGeometry args={[3.4, 0.08, 0.85]} />
          <meshStandardMaterial color={SHADE} flatShading />
        </mesh>

        {/* tail fin */}
        <mesh position={[0, 0.45, -1.05]}>
          <boxGeometry args={[0.06, 0.85, 0.65]} />
          <meshStandardMaterial color={SHADE} flatShading />
        </mesh>
        <mesh position={[0, 0.08, -1.2]}>
          <boxGeometry args={[1.3, 0.06, 0.38]} />
          <meshStandardMaterial color={SHADE} flatShading />
        </mesh>

        {/* engine pods */}
        <group position={[-1.05, -0.38, 0.1]}>
          <mesh rotation={[HALF_PI, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.6, 8]} />
            <meshStandardMaterial color={SHADE} flatShading />
          </mesh>
          <EngineGlow position={[0, 0, -0.4]} tier={tier} />
        </group>
        <group position={[1.05, -0.38, 0.1]}>
          <mesh rotation={[HALF_PI, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.6, 8]} />
            <meshStandardMaterial color={SHADE} flatShading />
          </mesh>
          <EngineGlow position={[0, 0, -0.4]} tier={tier} />
        </group>

        <Contrail anchor1={[-1.05, -0.38, -0.3]} anchor2={[1.05, -0.38, -0.3]} tier={tier} />
      </group>
    </group>
  );
}
