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

function VoxelMesh({
  model,
  active,
  targetSize = 24,
  spinSpeed = 0.2,
  pointer,
  reducedMotion,
}: {
  model: VoxelModel;
  active: boolean;
  targetSize?: number;
  spinSpeed?: number;
  pointer?: { x: number; y: number };
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const activeBlend = useRef(+!!active);

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
    activeBlend.current +=
      (+!!active - activeBlend.current) * Math.min(1, dt * (reducedMotion ? 12 : 2.6));
    const blend = activeBlend.current;
    if (blend < 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const appear = Math.max(0, Math.min(1, (blend - delays[i]) / 0.45));
      const ease = appear < 1 ? 1 - Math.pow(1 - appear, 3) : 1;
      dummy.position.set(offsets[i * 3], offsets[i * 3 + 1], offsets[i * 3 + 2]);
      if (ease < 1) {
        const scatter = (1 - ease) * 6;
        dummy.position.x += (hash01(i * 3.1) - 0.5) * scatter;
        dummy.position.y += (hash01(i * 5.7) - 0.5) * scatter;
        dummy.position.z += (hash01(i * 9.3) - 0.5) * scatter;
      }
      const s = ease * unit * 0.92;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (reducedMotion) {
      g.rotation.set(0, 0.5, 0);
      g.position.y = 0;
      return;
    }
    g.rotation.y += dt * spinSpeed;
    g.position.y = Math.sin(t * 0.9) * 0.7;
    if (pointer) {
      const tx = 0.28 * pointer.y;
      const tz = -(0.12 * pointer.x);
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

function CameraRig({
  pointer,
  reduced,
  distance,
}: {
  pointer: MutableRefObject<{ x: number; y: number }>;
  reduced: boolean;
  distance: number;
}) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    if (reduced) {
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      return;
    }
    const px = pointer.current.x;
    const py = pointer.current.y;
    camera.position.x += (5 * px - camera.position.x) * Math.min(1, 2.5 * dt);
    camera.position.y += (-3 * py + 2 - camera.position.y) * Math.min(1, 2.5 * dt);
    camera.position.z += (distance - camera.position.z) * Math.min(1, 2.5 * dt);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function SceneInner({
  activeKey,
  distance,
}: {
  activeKey: PixelObjectKey;
  distance: number;
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
      <hemisphereLight intensity={0.4} color="#d8dde8" groundColor="#101218" />
      <directionalLight position={[16, 22, 18]} intensity={1.15} />
      <pointLight position={[-18, 8, 14]} intensity={180} color="#5eead4" />
      <pointLight position={[18, -4, 10]} intensity={120} color="#f0a0b8" />
      <CameraRig pointer={pointer} reduced={reduced} distance={distance} />
      {models.map(({ key, model }) => (
        <VoxelMesh
          key={key}
          model={model}
          active={key === activeKey}
          targetSize={key === "plane" ? 28 : 24}
          spinSpeed={key === "ticket" ? 0.28 : 0.18}
          pointer={reduced ? undefined : pointer.current}
          reducedMotion={reduced}
        />
      ))}
    </>
  );
}

export function PixelScene({
  activeKey,
  className,
  distance = 46,
}: {
  activeKey: PixelObjectKey;
  className?: string;
  distance?: number;
}) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, distance], fov: 42, near: 0.1, far: 400 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <SceneInner activeKey={activeKey} distance={distance} />
        </Suspense>
      </Canvas>
    </div>
  );
}
