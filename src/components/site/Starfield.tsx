"use client";

import { useEffect, useRef } from "react";

/** Dense starfield + subtle grain — landing pin format. */
export function Starfield({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const stars: { x: number; y: number; r: number; a: number; s: number }[] =
      [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars.length = 0;
      const count = Math.floor((w * h) / 4200);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.35 + 0.2,
          a: Math.random() * 0.7 + 0.15,
          s: Math.random() * 0.25 + 0.05,
        });
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#030406";
      ctx.fillRect(0, 0, w, h);

      for (const star of stars) {
        const twinkle =
          0.55 + 0.45 * Math.sin(t * 0.0012 * star.s * 40 + star.x);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${star.a * twinkle})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
      aria-hidden
    >
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="site-grain absolute inset-0 opacity-[0.35]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(212,160,72,0.08),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(90,180,220,0.06),transparent_50%)]" />
    </div>
  );
}
