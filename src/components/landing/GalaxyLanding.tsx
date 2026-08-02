"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./landing.css";

const FINGERS: number[][][] = [
  [
    [0.3, 0.86],
    [0.2, 0.74],
    [0.13, 0.62],
    [0.1, 0.52],
  ],
  [
    [0.38, 0.9],
    [0.34, 0.66],
    [0.31, 0.44],
    [0.29, 0.27],
  ],
  [
    [0.48, 0.92],
    [0.47, 0.64],
    [0.46, 0.38],
    [0.45, 0.16],
  ],
  [
    [0.58, 0.9],
    [0.59, 0.66],
    [0.6, 0.42],
    [0.61, 0.22],
  ],
  [
    [0.68, 0.86],
    [0.71, 0.68],
    [0.74, 0.5],
    [0.77, 0.34],
  ],
];

const PALM: number[][] = [
  [0.3, 0.86],
  [0.38, 0.9],
  [0.48, 0.92],
  [0.58, 0.9],
  [0.68, 0.86],
  [0.62, 1.02],
  [0.36, 1.02],
];

function useStarfield(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; r: number; s: number; tw: number }[] =
      [];
    let raf = 0;
    let alive = true;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.floor((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        s: Math.random() * 0.25 + 0.03,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const tick = (t: number) => {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.y -= st.s;
        if (st.y < -2) st.y = h + 2;
        const flicker = 0.4 + Math.sin(t * 0.001 + st.tw) * 0.3;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,240,230,${0.25 * flicker + 0.08})`;
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    resize();
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

function useHandMesh(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = canvas.width = rect.width * dpr;
      h = canvas.height = rect.height * dpr;
    };

    const pt = (p: number[], wobble: number, t: number): [number, number] => {
      const jx = Math.sin(t * 0.0007 + p[0] * 10) * 0.004 * wobble;
      const jy = Math.cos(t * 0.0006 + p[1] * 10) * 0.004 * wobble;
      return [(p[0] + jx) * w, (p[1] + jy) * h];
    };

    const drawMeshLine = (
      a: [number, number],
      b: [number, number],
      alpha: number,
    ) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = `rgba(255,110,64,${alpha})`;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
    };

    const tick = (t: number) => {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const allPts: [number, number][] = [];
      for (const f of FINGERS) for (const p of f) allPts.push(pt(p, 1, t));
      for (const p of PALM) allPts.push(pt(p, 0.4, t));

      for (let i = 0; i < allPts.length; i++) {
        for (let j = i + 1; j < allPts.length; j++) {
          const dx = allPts[i][0] - allPts[j][0];
          const dy = allPts[i][1] - allPts[j][1];
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < w * 0.16) {
            drawMeshLine(allPts[i], allPts[j], 0.05 * (1 - d / (w * 0.16)));
          }
        }
      }

      for (const f of FINGERS) {
        for (let i = 0; i < f.length - 1; i++) {
          const a = pt(f[i], 1, t);
          const b = pt(f[i + 1], 1, t);
          drawMeshLine(a, b, 0.5);
          ctx.beginPath();
          ctx.arc(a[0], a[1], 1.6 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,150,90,0.6)";
          ctx.fill();
        }
      }

      for (let i = 0; i < PALM.length; i++) {
        const a = pt(PALM[i], 0.4, t);
        const b = pt(PALM[(i + 1) % PALM.length], 0.4, t);
        drawMeshLine(a, b, 0.35);
      }

      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    resize();
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

function useBrain(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Pt = { x: number; y: number; z: number; r: number; tw: number };
    let dpr = 1;
    let w = 0;
    let h = 0;
    let raf = 0;
    let alive = true;

    const genPoints = (n: number) => {
      const arr: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const lobe = Math.random() < 0.5 ? -1 : 1;
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        let x = Math.sin(v) * Math.cos(u);
        let y = Math.sin(v) * Math.sin(u) * 0.75;
        let z = Math.cos(v);
        x = x * 0.85 + lobe * 0.18;
        y = y * 0.62 - 0.05;
        z = z * 0.85;
        if (y > 0.45 && Math.random() < 0.6) continue;
        arr.push({
          x,
          y,
          z,
          r: Math.random() * 1.6 + 0.5,
          tw: Math.random() * Math.PI * 2,
        });
      }
      return arr;
    };

    const pts = genPoints(520);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = canvas.width = rect.width * dpr;
      h = canvas.height = rect.height * dpr;
    };

    const tick = (t: number) => {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const ry = t * 0.00022;
      const cx = w / 2;
      const cy = (h / 2) * 1.05;
      const scale = Math.min(w, h) * 0.42;

      const projected = pts
        .map((p) => {
          const cos = Math.cos(ry);
          const sin = Math.sin(ry);
          const x = p.x * cos - p.z * sin;
          const z = p.x * sin + p.z * cos;
          const y = p.y;
          const persp = 1 / (1.6 - z * 0.4);
          return {
            sx: cx + x * scale * persp,
            sy: cy + y * scale * persp,
            z,
            r: p.r,
            tw: p.tw,
          };
        })
        .sort((a, b) => a.z - b.z);

      for (const p of projected) {
        const depth = (p.z + 1) / 2;
        const flicker = 0.6 + Math.sin(t * 0.002 + p.tw) * 0.4;
        const hue = 18 + depth * 70;
        const alpha = (0.25 + depth * 0.55) * flicker;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 90%, ${60 + depth * 10}%, ${alpha})`;
        ctx.arc(
          p.sx,
          p.sy,
          p.r * dpr * (0.6 + depth * 0.8),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    resize();
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

export function GalaxyLanding() {
  const router = useRouter();
  const starRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<HTMLCanvasElement>(null);
  const brainRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  useStarfield(starRef);
  useHandMesh(handRef);
  useBrain(brainRef);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;

    const onMove = (e: PointerEvent) => {
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
      glow.style.opacity = "1";
    };
    const onLeave = () => {
      glow.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  function goLogin() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      router.push("/login");
    }, 520);
  }

  return (
    <div className={`aidhd-landing${leaving ? " leaving" : ""}`}>
      <canvas ref={starRef} className="starfield" aria-hidden />
      <canvas ref={handRef} className="hand-mesh" aria-hidden />
      <div className="reach-hand" aria-hidden>
        <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            className="reach-path"
            d="M40 260 C60 230 70 200 78 178 C82 168 92 160 100 168 C106 174 104 186 100 196 L118 150 C122 140 134 134 141 142 C147 149 145 160 140 170 L154 130 C158 119 171 114 178 122 C184 129 182 141 176 152 L186 118 C190 108 202 103 209 111 C215 118 213 129 207 140 L214 108 C219 96 233 92 240 101 C245 108 244 120 236 132 C224 150 214 168 210 186 C206 206 208 224 216 240"
            stroke="url(#handGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient
              id="handGrad"
              x1="40"
              y1="260"
              x2="240"
              y2="101"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#ff7a4d" stopOpacity="0.05" />
              <stop offset="0.6" stopColor="#ff8a5c" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffcbae" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="grain" aria-hidden />
      <div className="vignette" aria-hidden />
      <div ref={glowRef} className="cursor-glow" aria-hidden />

      <nav className="topnav">
        <Link href="/" className="logo">
          <strong>AiDHD</strong>
        </Link>
        <div className="nav-actions">
          <Link href="/demo" className="pill-btn hide-sm">
            demo <span className="arrow">↗</span>
          </Link>
          <Link href="/login" className="pill-btn">
            sign in <span className="arrow">↗</span>
          </Link>
        </div>
      </nav>

      <main className="hero-gate">
        <h1 className="brand-mark">AiDHD</h1>
        <button
          type="button"
          className="join-us-btn"
          aria-label="Join Us — sign in to AiDHD"
          onClick={goLogin}
        >
          <span className="ring ring-1" />
          <span className="ring ring-2" />
          <span className="label">Join Us</span>
        </button>
        <div className="caption">
          <p className="version">group nights & trips · agentic commerce</p>
          <p className="by">hands meet — plans finish</p>
        </div>
      </main>

      <footer className="foot-fixed">
        <a href="mailto:hello@aidhd.app">hello@aidhd.app</a>
        <span className="copyright">AiDHD · concierge for the group chat</span>
      </footer>

      <div className="blob blob-a" aria-hidden />
      <div className="blob blob-b" aria-hidden />

      <section className="story story-hero" aria-label="Product">
        <canvas ref={brainRef} className="brain-canvas" aria-hidden />
        <p className="eyebrow">collective planning</p>
        <h2>
          Unlock collective
          <br />
          nights &amp; trips.
        </h2>
        <p className="sub">
          Friends drop budgets in WhatsApp or iMessage. AiDHD reconciles the
          mess into costed packages — then books with scoped payments per
          category.
        </p>
      </section>

      <section className="story">
        <div className="features">
          <article className="feature">
            <p className="num">01 — Collect</p>
            <h3>Signal from every chat</h3>
            <p>
              Web, WhatsApp, and iMessage feed the same plan — budgets, vibes,
              and constraints without another spreadsheet.
            </p>
          </article>
          <article className="feature">
            <p className="num">02 — Reconcile</p>
            <h3>Plans that actually fit</h3>
            <p>
              The agent searches live inventory, ranks with trust signals, and
              surfaces 2–3 packages the whole group can vote on.
            </p>
          </article>
          <article className="feature">
            <p className="num">03 — Book</p>
            <h3>Pay per category</h3>
            <p>
              Separate Prava mandates for tickets, dining, flights, and hotels —
              so one failure never kills the whole night.
            </p>
          </article>
        </div>
      </section>

      <section className="closing">
        <h2>
          Ready when the
          <br />
          group chat is.
        </h2>
        <button type="button" className="pill-btn solid" onClick={goLogin}>
          Join Us
        </button>
      </section>
    </div>
  );
}
