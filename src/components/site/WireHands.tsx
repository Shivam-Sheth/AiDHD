"use client";

/** Decorative wireframe + photo-hand cues for the Join us / login pin. */
export function WireHands() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute -left-8 top-[8%] h-[70%] w-auto max-w-[55vw] text-[var(--coral)] opacity-80"
        viewBox="0 0 320 480"
        fill="none"
      >
        <g
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
          className="animate-[hand-drift_8s_ease-in-out_infinite]"
        >
          <path d="M190 40c-10 30-18 70-20 110-2 42 6 80 10 120" />
          <path d="M170 150c-28 8-52 30-62 58-12 34-8 72 8 102" />
          <path d="M200 148c22 4 48 22 58 48 14 36 8 78-12 108" />
          <path d="M148 220c-18 22-28 52-26 84 2 28 14 52 32 70" />
          <path d="M220 230c20 18 34 48 32 80-2 30-16 56-36 74" />
          <path d="M175 250c-6 40-4 78 6 112" />
          <path d="M120 300c30 40 70 70 120 78" />
          <circle cx="188" cy="140" r="18" />
          <path d="M120 360 L100 420 M140 370 L130 430 M170 380 L168 440 M200 375 L210 435 M230 360 L250 415" />
          {/* mesh lattice */}
          <path d="M150 180 L210 175 M145 210 L215 205 M140 250 L220 245 M145 290 L215 285" opacity="0.55" />
        </g>
      </svg>

      <div className="absolute -right-6 bottom-0 h-[42%] w-[38%] max-w-md bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_68%)] blur-sm" />
      <svg
        className="absolute -right-4 bottom-[-4%] h-[48%] w-auto max-w-[42vw] text-white/35"
        viewBox="0 0 280 360"
        fill="none"
      >
        <g stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M40 340c40-70 70-120 95-150 18-22 40-30 62-28 28 2 48 22 54 48 4 18-2 36-14 50L160 340" />
          <path d="M120 210c8-28 28-48 52-52" />
          <path d="M168 165c6-22 22-38 42-42" />
          <path d="M95 250c-10-30-8-58 8-80" />
        </g>
      </svg>
    </div>
  );
}
