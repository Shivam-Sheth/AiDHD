"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero backdrop: a slowly drifting starfield.
 *
 * Pure Three.js, isolated in its own client component so it can be
 * lazy-loaded and kept out of the server bundle entirely.
 */

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function starCountFor(width: number): number {
  if (width < 640) return 320;
  if (width < 1024) return 700;
  return 1400;
}

export function HeroScene({ onUnavailable }: { onUnavailable?: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!supportsWebGL()) {
      onUnavailable?.();
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const starCount = starCountFor(container.clientWidth);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      120,
    );
    camera.position.set(0, 0.5, 6.5);
    camera.lookAt(0, 0.4, -10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    container.appendChild(renderer.domElement);

    // --- Starfield -----------------------------------------------------
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 60;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 10;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xeef1ff,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    renderer.render(scene, camera);

    if (reducedMotion) {
      return () => {
        renderer.dispose();
        starGeo.dispose();
        starMat.dispose();
        container.removeChild(renderer.domElement);
      };
    }

    // --- Animation loop ---------------------------------------------------
    let raf = 0;
    const clock = new THREE.Clock();

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.05);
      stars.rotation.y += delta * 0.006;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.dispose();
      starGeo.dispose();
      starMat.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onUnavailable]);

  return <div ref={containerRef} className="h-full w-full" aria-hidden="true" />;
}
