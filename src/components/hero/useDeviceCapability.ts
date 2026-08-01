"use client";

import { useSyncExternalStore } from "react";

export type DeviceTier = "full" | "lite" | "off";

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function subscribe() {
  // Device capability doesn't change over a page lifetime — nothing to subscribe to.
  return () => {};
}

function getSnapshot(): DeviceTier {
  if (!probeWebgl()) return "off";
  const isLite =
    (navigator.hardwareConcurrency ?? 8) <= 4 ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.innerWidth < 768;
  return isLite ? "lite" : "full";
}

function getServerSnapshot(): DeviceTier | null {
  return null;
}

export function useDeviceCapability(): DeviceTier | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
