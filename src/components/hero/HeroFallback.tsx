export function HeroFallback() {
  return (
    <div className="animate-drift-plane absolute top-[10%] right-[6%] sm:top-[16%] sm:right-[10%] lg:top-[20%] lg:right-[12%]">
      <svg width="120" height="120" viewBox="0 0 180 180" fill="none" aria-hidden className="sm:h-40 sm:w-40 lg:h-[180px] lg:w-[180px]">
        <g>
          <ellipse cx="90" cy="90" rx="70" ry="70" fill="var(--color-gold)" opacity="0.18" />
          <path
            d="M90 30 L102 100 L150 118 L150 128 L102 118 L96 150 L114 162 L114 170 L90 164 L66 170 L66 162 L84 150 L78 118 L30 128 L30 118 L78 100 Z"
            fill="var(--color-dusk-ink)"
            stroke="var(--color-gold)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
