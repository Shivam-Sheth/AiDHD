import type { HeroHandAssets } from "@/lib/hero-assets";

/**
 * The hero backdrop: a wireframe hand reaching in from the upper left and a
 * human hand from the lower right, fingertips meeting on a bloom at the centre.
 *
 * CONTACT is deliberately the exact centre of the viewBox: with
 * preserveAspectRatio="xMidYMid slice" the viewBox centre always lands on the
 * container centre, so the hero can pin its CTA to the touch with a plain
 * 50%/50% translate at any viewport size.
 */

export const VIEWBOX = { w: 1600, h: 620 } as const;
export const CONTACT = { x: 800, y: 310 } as const;

/** Pointing-hand silhouette, drawn once and reused mirrored for the human hand. */
const HAND_PATH =
  "M0,52 L44,40 C96,26 148,40 186,72 C204,87 224,101 250,110 L300,124 L354,139 " +
  "C368,143 374,148 374,154 C374,161 366,166 353,166 L300,161 L250,154 " +
  "C266,170 270,189 260,205 C250,221 228,227 210,219 " +
  "C220,237 212,257 192,263 C170,270 148,259 140,241 " +
  "C136,257 120,266 104,262 C84,257 72,240 72,220 " +
  "C48,218 24,204 8,182 C1,171 0,160 0,148 Z";

/**
 * Interior creases for the solid hand. Without them a filled silhouette reads
 * as a mitten — these are what separate the curled fingers and set the knuckle.
 */
const CREASES = [
  "M210,219 C204,200 200,186 198,172", // index / middle split
  "M140,241 C136,222 133,207 132,193", // middle / ring split
  "M72,220 C74,204 77,192 80,182", // ring / little split
  "M250,154 C232,150 210,150 190,154", // knuckle line under the index
  "M186,72 C196,92 200,112 198,132", // thumb edge
];

/** Hand-local coordinates of the index fingertip, used to solve the transforms. */
const TIP = { x: 374, y: 154 };

const MESH_SCALE = 1.42;
const HUMAN_SCALE = 1.24;

const meshTransform = `rotate(16 ${CONTACT.x - 8} ${CONTACT.y}) translate(${(
  CONTACT.x -
  8 -
  MESH_SCALE * TIP.x
).toFixed(1)},${(CONTACT.y - MESH_SCALE * TIP.y).toFixed(1)}) scale(${MESH_SCALE})`;

const humanTransform = `rotate(11 ${CONTACT.x + 14} ${CONTACT.y}) translate(${(
  CONTACT.x +
  14 +
  HUMAN_SCALE * TIP.x
).toFixed(1)},${(CONTACT.y - HUMAN_SCALE * TIP.y).toFixed(1)}) scale(${-HUMAN_SCALE},${HUMAN_SCALE})`;

/** Bowed grid, clipped to the silhouette — reads as a quad mesh over the form. */
const MESH_LINES: string[] = [];
for (let x = -10; x < 390; x += 11) MESH_LINES.push(`M${x},-10 Q${x + 16},150 ${x},310`);
for (let y = -10; y < 290; y += 11) MESH_LINES.push(`M-10,${y} Q190,${y - 14} 390,${y}`);

/**
 * Deterministic PRNG — the starfield must be identical on server and client or
 * React reports a hydration mismatch.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rand = mulberry32(20260801);
  return Array.from({ length: 150 }, () => ({
    cx: +(rand() * VIEWBOX.w).toFixed(1),
    cy: +(rand() * VIEWBOX.h).toFixed(1),
    r: +(0.5 + rand() * 0.9).toFixed(2),
    o: +(0.12 + rand() * 0.55).toFixed(2),
  }));
})();

export function HandsScene({ assets }: { assets: HeroHandAssets }) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <clipPath id="handClip">
          <path d={HAND_PATH} />
        </clipPath>

        {/* Alpha lives in the paint rather than a <mask>: the arm end dissolves
            into the field instead of being hard-cropped at the frame edge. */}
        <linearGradient id="meshFade" gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="210" y2="0">
          <stop offset="0" stopColor="var(--mesh)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--mesh)" stopOpacity="0.95" />
        </linearGradient>

        <linearGradient id="skin" gradientUnits="userSpaceOnUse" x1="374" y1="140" x2="60" y2="240">
          <stop offset="0" stopColor="#ffe0c6" />
          <stop offset="0.2" stopColor="#e8a375" />
          <stop offset="0.5" stopColor="#b0714a" stopOpacity="0.95" />
          <stop offset="0.8" stopColor="#5c3522" stopOpacity="0.7" />
          <stop offset="1" stopColor="#241409" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="rim" gradientUnits="userSpaceOnUse" x1="374" y1="0" x2="140" y2="0">
          <stop offset="0" stopColor="#ffd9bd" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd9bd" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="bloom">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.12" stopColor="#fff4e8" stopOpacity="0.8" />
          <stop offset="0.38" stopColor="#ffc79e" stopOpacity="0.33" />
          <stop offset="1" stopColor="#ff9d76" stopOpacity="0" />
        </radialGradient>
      </defs>

      {STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="var(--ink)" opacity={s.o} />
      ))}

      {/* --hand-shift is driven by HandsProximity; 1px == 1 scene unit here. */}
      <g style={{ transform: "translateX(calc(var(--hand-shift, 115px) * -1))" }}>
        {assets.mesh ? (
        <image
          href={assets.mesh}
          x="0"
          y="0"
          width={CONTACT.x}
          height={VIEWBOX.h}
          preserveAspectRatio="xMaxYMid meet"
        />
      ) : (
        <g transform={meshTransform}>
          <g clipPath="url(#handClip)" fill="none" stroke="url(#meshFade)" strokeWidth="0.9">
            {MESH_LINES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path d={HAND_PATH} fill="none" stroke="url(#meshFade)" strokeWidth="1.5" />
          </g>
        )}
      </g>

      <g style={{ transform: "translateX(var(--hand-shift, 115px))" }}>
        {assets.human ? (
        <image
          href={assets.human}
          x={CONTACT.x}
          y="0"
          width={VIEWBOX.w - CONTACT.x}
          height={VIEWBOX.h}
          preserveAspectRatio="xMinYMid meet"
        />
      ) : (
        <g transform={humanTransform}>
          <path d={HAND_PATH} fill="url(#skin)" />
          <g fill="none" stroke="#2a160d" strokeOpacity="0.5" strokeWidth="2.2" strokeLinecap="round">
            {CREASES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path d={HAND_PATH} fill="none" stroke="url(#rim)" strokeWidth="1.4" />
          {/* fingernail catch-light, sells the lit fingertip */}
          <ellipse
            cx="345"
            cy="150"
            rx="14"
            ry="7"
            fill="#fff1e2"
            opacity="0.5"
            transform="rotate(6 345 150)"
            />
          </g>
        )}
      </g>

      <circle cx={CONTACT.x} cy={CONTACT.y} r="150" fill="url(#bloom)" className="animate-contact" />
      <circle cx={CONTACT.x} cy={CONTACT.y} r="5" fill="#fff8f0" />
    </svg>
  );
}
