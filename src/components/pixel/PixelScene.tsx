"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import {
  MODEL_BUILDERS,
  PIXEL_OBJECT_ORDER,
  type PixelObjectKey,
  type VoxelModel,
} from "@/lib/pixel/voxels";

function hash01(n: number) {
  const t = 43758.5453 * Math.sin(127.1 * n);
  return t - Math.floor(t);
}

const JOURNEY_SLOTS: Record<
  PixelObjectKey,
  { x: number; y: number; z: number; scale: number }
> = {
  plane: { x: -16, y: 4, z: -2, scale: 0.85 },
  hotel: { x: -4, y: -1, z: 2, scale: 0.9 },
  ticket: { x: 8, y: 2, z: -1, scale: 0.8 },
  dining: { x: 18, y: -2, z: 1, scale: 0.75 },
};

function VoxelMesh({
  model,
  active,
  alwaysVisible = false,
  targetSize = 24,
  spinSpeed = 0.2,
  pointer,
  reducedMotion,
  slot,
}: {
  model: VoxelModel;
  active: boolean;
  alwaysVisible?: boolean;
  targetSize?: number;
  spinSpeed?: number;
  pointer?: { x: number; y: number };
  reducedMotion: boolean;
  slot?: { x: number; y: number; z: number; scale: number };
}) {
  const group = useRef<THREE.Group>(null);
  const activeBlend = useRef(alwaysVisible ? 0.55 : +!!active);

  const { count, unit, offsets, delays } = useMemo(() => {
    const u = targetSize / model.extent;
    const n = model.voxels.length;
    const offs = new Float32Array(n * 3);
    const dels = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = model.voxels[i];
      offs[i * 3] = v.x * u;
      offs[i * 3 + 1] = v.y * u;
      offs[i * 3 + 2] = v.z * u;
      dels[i] = 0.55 * hash01(i);
    }
    return { count: n, unit: u, offsets: offs, delays: dels };
  }, [model, targetSize]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  const mesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ toneMapped: false });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      colorScratch.set(model.voxels[i].color);
      inst.setColorAt(i, colorScratch);
      dummy.position.set(offsets[i * 3], offsets[i * 3 + 1], offsets[i * 3 + 2]);
      dummy.scale.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [model, count, offsets, dummy, colorScratch]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;

    const target = alwaysVisible ? (active ? 1 : 0.42) : +!!active;
    activeBlend.current +=
      (target - activeBlend.current) * Math.min(1, dt * (reducedMotion ? 12 : 2.4));
    const blend = activeBlend.current;
    if (blend < 0.02 && !alwaysVisible) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const t = state.clock.elapsedTime;
    const sizeMul = (slot?.scale ?? 1) * (active ? 1.08 : 0.92);
    for (let i = 0; i < count; i++) {
      const appear = Math.max(0, Math.min(1, (blend - delays[i] * 0.35) / 0.4));
      const ease = appear < 1 ? 1 - Math.pow(1 - appear, 3) : 1;
      dummy.position.set(offsets[i * 3], offsets[i * 3 + 1], offsets[i * 3 + 2]);
      if (ease < 1 && active) {
        const scatter = (1 - ease) * 4;
        dummy.position.x += (hash01(i * 3.1) - 0.5) * scatter;
        dummy.position.y += (hash01(i * 5.7) - 0.5) * scatter;
        dummy.position.z += (hash01(i * 9.3) - 0.5) * scatter;
      }
      const s = ease * unit * 0.9 * sizeMul;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const baseX = slot?.x ?? 0;
    const baseY = slot?.y ?? 0;
    const baseZ = slot?.z ?? 0;
    g.position.x += (baseX - g.position.x) * Math.min(1, 3 * dt);
    g.position.z += (baseZ - g.position.z) * Math.min(1, 3 * dt);

    if (reducedMotion) {
      g.rotation.set(0, 0.45, 0);
      g.position.y = baseY;
      return;
    }
    g.rotation.y += dt * spinSpeed * (active ? 1 : 0.45);
    g.position.y = baseY + Math.sin(t * 0.9 + baseX * 0.05) * (active ? 0.7 : 0.35);
    if (pointer && active) {
      const tx = 0.22 * pointer.y;
      const tz = -(0.1 * pointer.x);
      g.rotation.x += (tx - g.rotation.x) * Math.min(1, 3 * dt);
      g.rotation.z += (tz - g.rotation.z) * Math.min(1, 3 * dt);
    }
  });

  return (
    <group ref={group}>
      <primitive object={mesh} />
    </group>
  );
}

function JourneyPath() {
  const points = useMemo(() => {
    const keys = PIXEL_OBJECT_ORDER;
    return keys.map((k) => {
      const s = JOURNEY_SLOTS[k];
      return new THREE.Vector3(s.x, s.y - 6, s.z);
    });
  }, []);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const line = useMemo(() => {
    const pts = curve.getPoints(48);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: "#5eead4",
      transparent: true,
      opacity: 0.35,
    });
    return new THREE.Line(geo, mat);
  }, [curve]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

function CameraRig({
  pointer,
  reduced,
  distance,
  journey,
}: {
  pointer: MutableRefObject<{ x: number; y: number }>;
  reduced: boolean;
  distance: number;
  journey: boolean;
}) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const baseZ = journey ? distance + 10 : distance;
    const baseY = journey ? 6 : 2;
    if (reduced) {
      camera.position.set(0, baseY, baseZ);
      camera.lookAt(0, 0, 0);
      return;
    }
    const px = pointer.current.x;
    const py = pointer.current.y;
    camera.position.x += ((journey ? 2 : 5) * px - camera.position.x) * Math.min(1, 2.2 * dt);
    camera.position.y +=
      (baseY - 2 * py - camera.position.y) * Math.min(1, 2.2 * dt);
    camera.position.z += (baseZ - camera.position.z) * Math.min(1, 2.2 * dt);
    camera.lookAt(journey ? 2 : 0, 0, 0);
  });
  return null;
}

function SceneInner({
  activeKey,
  distance,
  journey,
}: {
  activeKey: PixelObjectKey;
  distance: number;
  journey: boolean;
}) {
  const pointer = useRef({ x: 0, y: 0 });
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  const models = useMemo(
    () =>
      PIXEL_OBJECT_ORDER.map((key) => ({
        key,
        model: MODEL_BUILDERS[key](),
      })),
    [],
  );

  return (
    <>
      <ambientLight intensity={0.95} />
      <hemisphereLight intensity={0.45} color="#d8dde8" groundColor="#101218" />
      <directionalLight position={[16, 22, 18]} intensity={1.2} />
      <pointLight position={[-18, 8, 14]} intensity={160} color="#5eead4" />
      <pointLight position={[18, -4, 10]} intensity={110} color="#f0a0b8" />
      <CameraRig
        pointer={pointer}
        reduced={reduced}
        distance={distance}
        journey={journey}
      />
      {journey && <JourneyPath />}
      {models.map(({ key, model }) => (
        <VoxelMesh
          key={key}
          model={model}
          active={key === activeKey}
          alwaysVisible={journey}
          targetSize={key === "plane" ? 26 : 22}
          spinSpeed={key === "ticket" ? 0.26 : 0.16}
          pointer={reduced ? undefined : pointer.current}
          reducedMotion={reduced}
          slot={journey ? JOURNEY_SLOTS[key] : undefined}
        />
      ))}
    </>
  );
}

export function PixelScene({
  activeKey,
  className,
  distance = 46,
  journey = true,
}: {
  activeKey: PixelObjectKey;
  className?: string;
  distance?: number;
  journey?: boolean;
}) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, journey ? 6 : 0, distance], fov: 42, near: 0.1, far: 400 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <SceneInner
            activeKey={activeKey}
            distance={distance}
            journey={journey}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
