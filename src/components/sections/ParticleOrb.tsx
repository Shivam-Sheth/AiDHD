/**
 * The reference reel anchors its intro section with a large glowing 3D render.
 * This is the code-drawn equivalent: a Fibonacci-sphere point cloud projected
 * to 2D, with radius and opacity driven by depth so it reads as a volume.
 */

const N = 620;
const R = 150;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type Dot = { x: number; y: number; r: number; o: number; front: boolean };

const DOTS: Dot[] = (() => {
  const out: Dot[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const x = Math.cos(theta) * ring;
    const z = Math.sin(theta) * ring;

    // z in [-1, 1]; 1 is nearest the viewer.
    const depth = (z + 1) / 2;
    out.push({
      x: +(x * R).toFixed(2),
      y: +(y * R).toFixed(2),
      r: +(0.7 + depth * 2.1).toFixed(2),
      o: +(0.12 + depth * 0.72).toFixed(3),
      front: z >= 0,
    });
  }
  // Painter's algorithm — back hemisphere first so front dots sit on top.
  return out.sort((a, b) => Number(a.front) - Number(b.front));
})();

export function ParticleOrb({ className }: { className?: string }) {
  return (
    <svg viewBox="-200 -200 400 400" className={className} aria-hidden>
      <defs>
        <radialGradient id="orbCore">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="var(--mesh)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--mesh)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="0" cy="0" r="185" fill="url(#orbCore)" />
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={d.front ? "var(--mesh)" : "var(--accent)"}
          opacity={d.o}
        />
      ))}
    </svg>
  );
}
