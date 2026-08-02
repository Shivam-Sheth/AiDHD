"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OAUTH_ERRORS: Record<string, string> = {
  google_oauth_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet.",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const starRef = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    () => OAUTH_ERRORS[params.get("error") || ""] || null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const canvas = starRef.current;
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
      const count = Math.floor((w * h) / 12000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.2,
        s: Math.random() * 0.2 + 0.02,
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
        ctx.fillStyle = `rgba(255,240,230,${0.22 * flicker + 0.06})`;
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
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    router.push("/agent");
  }

  async function handleGoogleSignIn() {
    if (!supabase) {
      setError(OAUTH_ERRORS.google_not_configured);
      return;
    }
    setError(null);
    setGoogleBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(OAUTH_ERRORS.google_oauth_failed);
      setGoogleBusy(false);
    }
  }

  const fieldClass =
    "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[#f3f2ee] shadow-none outline-none transition placeholder:text-white/30 focus:border-[rgba(255,148,87,0.55)] focus:ring-2 focus:ring-[rgba(255,106,61,0.2)]";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07070a] text-[#f3f2ee]">
      <canvas
        ref={starRef}
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(255,106,61,0.16), transparent 45%), radial-gradient(ellipse at 80% 10%, rgba(53,208,192,0.1), transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(139,108,246,0.08), transparent 50%)",
        }}
        aria-hidden
      />

      <header className="mx-auto flex max-w-3xl items-baseline justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-semibold tracking-tight text-[#f3f2ee] transition-opacity hover:opacity-70"
        >
          AiDHD
        </Link>
        <Link
          href="/"
          className="text-sm text-white/45 transition-colors hover:text-[rgba(255,148,87,0.9)]"
        >
          Back home
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl justify-center px-5 pb-24 pt-14 sm:px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-[rgba(255,148,87,0.9)]">
            Welcome
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-[#f3f2ee]">
            Join Us
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Sign in to plan nights and trips with your group — name and email
            required, phone optional.
          </p>

          <form
            onSubmit={handleSubmit}
            className="animate-slide-up mt-10 space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Lee"
                className={fieldClass}
                autoComplete="name"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={fieldClass}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-white/70">
                  Phone number
                </span>
                <span className="text-xs font-medium text-white/35">
                  Optional
                </span>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={fieldClass}
                autoComplete="tel"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={fieldClass}
                autoComplete="current-password"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6a3d] to-[#ff9457] px-6 py-3 font-display text-base font-semibold text-white shadow-[0_8px_30px_rgba(255,106,61,0.35)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-white/35">
              or
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={googleBusy}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3 font-display text-base font-semibold text-[#f3f2ee] transition hover:border-[rgba(255,148,87,0.45)] hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
          >
            <svg viewBox="0 0 18 18" className="h-5 w-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.88 2.69-6.64z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z"
              />
            </svg>
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </button>
        </div>
      </main>
    </div>
  );
}
