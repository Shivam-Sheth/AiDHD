import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Optional 3D models. Same drop-in contract as the hero hand art: put the file
 * in `public/models/` and it starts rendering on the next request.
 *
 * The check runs on the server because `useGLTF` suspends forever on a missing
 * file — there is no in-browser way to fall back gracefully after the fact.
 */
const MODELS = {
  plane: "models/boeing-777-300.glb",
} as const;

export type ModelKey = keyof typeof MODELS;

export function getModelSrc(key: ModelKey): string | null {
  const rel = MODELS[key];
  return existsSync(path.join(process.cwd(), "public", rel)) ? `/${rel}` : null;
}
