"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Starfield } from "@/components/site/Starfield";
import { WireHands } from "@/components/site/WireHands";
import { ThemeToggle } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OAUTH_ERRORS: Record<string, string> = {
  google_oauth_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet.",
};

const fieldClass =
  "field w-full border border-[var(--edge)] bg-black/40 px-4 py-3 font-mono text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--inkmute)] focus:border-[var(--coral)]";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const startOpen = params.get("form") === "1" || params.get("mode") === "signup";
  const [open, setOpen] = useState(startOpen);
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    () => OAUTH_ERRORS[params.get("error") || ""] || null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function syncProfile(accessToken: string) {
    await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    }).catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      );
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone: phone.trim() || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError(
            "Check your email to confirm your account, then sign in.",
          );
          setMode("signin");
          setSubmitting(false);
          return;
        }
        await syncProfile(data.session.access_token);
        router.push("/app");
        return;
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError) throw signInError;
      if (!data.session) throw new Error("No session returned");
      await syncProfile(data.session.access_token);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSubmitting(false);
    }
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--void)] text-[var(--ink)]">
      <Starfield />
      <WireHands />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 pt-7 lg:px-10">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.18em] text-[var(--inksoft)] uppercase transition hover:text-[var(--ink)]"
        >
          ← home
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle className="font-mono text-[10px] tracking-[0.14em] text-[var(--inkmute)] uppercase border border-[var(--edge)] px-2 py-1 hover:border-[var(--coral)] hover:text-[var(--coral)]" />
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-join"
            >
              join us
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-center px-5 pb-16">
        {!open ? (
          <div className="animate-fade-in flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open join form"
              className="animate-pulse-ring mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition hover:border-[var(--coral)] hover:bg-white/10"
            >
              <span className="ml-1 border-y-[7px] border-l-[12px] border-y-transparent border-l-[var(--inksoft)]" />
            </button>
            <p className="font-mono text-sm tracking-[0.08em] text-[var(--coral)] lowercase">
              aidhd OS 0.1
            </p>
            <p className="mt-2 font-mono text-xs tracking-[0.2em] text-[var(--inkmute)] lowercase">
              by
            </p>
            <p className="mt-2 font-display text-2xl font-bold tracking-[0.12em] text-[var(--coral)] uppercase">
              AiDHD
            </p>
            <p className="mt-8 max-w-xs font-mono text-[11px] leading-relaxed tracking-[0.06em] text-[var(--inkmute)]">
              Group nights & trips — chat, plans, Prava pay.
            </p>
          </div>
        ) : (
          <div className="animate-slide-up w-full max-w-sm">
            <div className="mb-6 text-center">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--coral)] uppercase">
                join us
              </p>
              <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--ink)] uppercase">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>
            </div>

            <div className="flex justify-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 border ${
                  mode === "signin"
                    ? "border-[var(--coral)] text-[var(--coral)]"
                    : "border-[var(--edge)] text-[var(--inkmute)]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`font-mono text-[11px] tracking-[0.14em] uppercase px-3 py-1.5 border ${
                  mode === "signup"
                    ? "border-[var(--coral)] text-[var(--coral)]"
                    : "border-[var(--edge)] text-[var(--inkmute)]"
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] tracking-[0.14em] text-[var(--inksoft)] uppercase">
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
              )}

              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] tracking-[0.14em] text-[var(--inksoft)] uppercase">
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

              {mode === "signup" && (
                <label className="block">
                  <span className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--inksoft)] uppercase">
                      Phone
                    </span>
                    <span className="font-mono text-[10px] text-[var(--inkmute)] uppercase">
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
              )}

              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] tracking-[0.14em] text-[var(--inksoft)] uppercase">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={fieldClass}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>

              {error && (
                <p className="border border-red-400/30 bg-red-400/10 px-3 py-2 font-mono text-xs text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-join w-full justify-center !py-3 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting
                  ? "working…"
                  : mode === "signup"
                    ? "create account →"
                    : "sign in →"}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--edge)]" />
              <span className="font-mono text-[10px] text-[var(--inkmute)] uppercase">
                or
              </span>
              <div className="h-px flex-1 bg-[var(--edge)]" />
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleBusy}
              className="btn-ghost mt-6 w-full gap-3 font-mono text-xs tracking-[0.12em] uppercase disabled:cursor-wait disabled:opacity-60"
            >
              {googleBusy ? "Redirecting…" : "Continue with Google"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full font-mono text-[10px] tracking-[0.16em] text-[var(--inkmute)] uppercase hover:text-[var(--inksoft)]"
            >
              ← back
            </button>
          </div>
        )}
      </main>

      <footer className="relative z-10 pb-6 text-center font-mono text-[10px] tracking-[0.14em] text-[var(--inkmute)] lowercase">
        hello@aidhd.app · copyright AiDHD 2026
      </footer>
    </div>
  );
}
