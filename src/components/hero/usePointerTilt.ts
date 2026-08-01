"use client";

import { useEffect, useRef } from "react";

/** Ref-based pointer tracking, normalized to [-1, 1]. Avoids re-renders — read directly in useFrame. */
export function usePointerTilt() {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return pointer;
}
