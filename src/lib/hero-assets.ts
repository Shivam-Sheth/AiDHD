import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Optional art for the hands hero. Drop either file into `public/` and it
 * replaces the code-drawn fallback on the next request — no code change.
 *
 * Authoring contract: each image should be transparent PNG/WebP with the
 * pointing fingertip touching the *inner* edge of the canvas at 50% height
 * (mesh hand: right edge; human hand: left edge). That is what lets the two
 * meet on the contact point without per-asset nudging.
 */
const CANDIDATES = ["png", "webp", "jpg"] as const;

function findAsset(base: string): string | null {
  for (const ext of CANDIDATES) {
    const rel = `/${base}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", `${base}.${ext}`))) return rel;
  }
  return null;
}

export type HeroHandAssets = {
  mesh: string | null;
  human: string | null;
};

export function getHeroHandAssets(): HeroHandAssets {
  return {
    mesh: findAsset("hero-hand-mesh"),
    human: findAsset("hero-hand-human"),
  };
}
