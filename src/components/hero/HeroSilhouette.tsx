export function HeroSilhouette() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* stage light beams sweeping the sky */}
      <div className="absolute bottom-[30%] left-[18%] h-[46vh] w-2 origin-bottom bg-gradient-to-t from-gold/70 to-transparent blur-sm animate-beam" />
      <div
        className="absolute bottom-[30%] left-[22%] h-[40vh] w-2 origin-bottom bg-gradient-to-t from-coral/60 to-transparent blur-sm animate-beam"
        style={{ animationDelay: "-2s" }}
      />
      <div
        className="absolute bottom-[30%] right-[20%] h-[44vh] w-2 origin-bottom bg-gradient-to-t from-violet/60 to-transparent blur-sm animate-beam"
        style={{ animationDelay: "-4s" }}
      />

      {/* crowd ridge */}
      <svg
        className="absolute bottom-[26%] left-0 h-[8%] w-full"
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
      >
        <path
          d="M0 24 L0 14 Q5 8 10 14 Q15 6 20 14 Q25 9 30 14 Q35 7 40 14 Q45 10 50 14 Q55 6 60 14 Q65 9 70 14 Q75 7 80 14 Q85 10 90 14 Q95 6 100 14 L100 24 Z"
          fill="var(--color-dusk-950)"
          opacity="0.85"
          transform="scale(4,1)"
        />
      </svg>

      {/* stage rig, center */}
      <svg
        className="absolute bottom-[24%] left-1/2 h-[16%] w-[26%] -translate-x-1/2"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMax meet"
      >
        <polygon points="60,100 140,100 120,20 80,20" fill="var(--color-dusk-950)" />
        <rect x="20" y="10" width="8" height="90" fill="var(--color-dusk-950)" />
        <rect x="172" y="10" width="8" height="90" fill="var(--color-dusk-950)" />
        <rect x="20" y="8" width="160" height="6" fill="var(--color-dusk-950)" />
      </svg>

      {/* palm trees */}
      <svg
        className="absolute bottom-[24%] left-[4%] h-[24%] w-[10%]"
        viewBox="0 0 100 200"
        preserveAspectRatio="xMidYMax meet"
      >
        <path d="M48 200 L52 90 L56 200 Z" fill="var(--color-dusk-950)" />
        <g fill="var(--color-dusk-950)">
          <path d="M52 90 Q10 70 5 30 Q40 55 52 90 Z" />
          <path d="M52 90 Q95 65 92 20 Q55 50 52 90 Z" />
          <path d="M52 90 Q20 100 0 85 Q30 78 52 90 Z" />
          <path d="M52 90 Q85 105 100 88 Q75 80 52 90 Z" />
        </g>
      </svg>
      <svg
        className="absolute bottom-[23%] right-[6%] h-[19%] w-[8%]"
        viewBox="0 0 100 200"
        preserveAspectRatio="xMidYMax meet"
      >
        <path d="M48 200 L52 95 L56 200 Z" fill="var(--color-dusk-950)" />
        <g fill="var(--color-dusk-950)">
          <path d="M52 95 Q15 78 10 40 Q42 60 52 95 Z" />
          <path d="M52 95 Q90 70 88 30 Q56 55 52 95 Z" />
          <path d="M52 95 Q22 104 3 90 Q32 84 52 95 Z" />
        </g>
      </svg>

      {/* ocean, animated drift bands */}
      <div className="absolute bottom-0 left-0 h-[24%] w-full bg-ocean">
        <div className="absolute inset-x-0 top-0 h-3 overflow-hidden">
          <div
            className="animate-wave h-full w-[200%] opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(100deg, transparent 0 40px, var(--color-gold) 40px 42px)",
            }}
          />
        </div>
        <div className="absolute inset-x-0 top-6 h-2 overflow-hidden">
          <div
            className="animate-wave h-full w-[200%] opacity-25"
            style={{
              animationDuration: "20s",
              animationDirection: "reverse",
              backgroundImage:
                "repeating-linear-gradient(100deg, transparent 0 60px, var(--color-coral) 60px 62px)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
