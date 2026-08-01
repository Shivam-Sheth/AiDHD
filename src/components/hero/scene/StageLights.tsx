"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function StageLights() {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (left.current) left.current.rotation.z = Math.sin(t * 0.5) * 0.5 - 0.3;
    if (right.current) right.current.rotation.z = Math.sin(t * 0.5 + Math.PI) * 0.5 + 0.3;
  });

  return (
    <group position={[0, -3, -4]}>
      <mesh ref={left} position={[-1.4, 0, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[1.1, 5, 16, 1, true]} />
        <meshBasicMaterial
          color="#ffb347"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={right} position={[1.4, 0, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[1.1, 5, 16, 1, true]} />
        <meshBasicMaterial
          color="#6d4aff"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
