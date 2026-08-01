"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OAUTH_ERRORS: Record<string, string> = {
  google_oauth_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet.",
};

const fieldClass =
  "w-full border border-[var(--edge)] bg-[var(--void)] px-4 py-3 text-[var(--ink)] outline-none transition placeholder:text-[var(--inkmute)] focus:border-[var(--edgehot)]";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    () => OAUTH_ERRORS[params.get("error") || ""] || null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 site-atmosphere"
        aria-hidden
      />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]"
        >
          AiDHD
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
          >
            Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl justify-center px-5 pb-24 pt-14 sm:px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)]">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--inksoft)]">
            Name and email are required — phone number is optional.
          </p>

          <form onSubmit={handleSubmit} className="animate-slide-up mt-10 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-[var(--inksoft)]">
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
              <span className="mb-1.5 block text-sm text-[var(--inksoft)]">
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
                <span className="text-sm text-[var(--inksoft)]">Phone</span>
                <span className="text-xs text-[var(--inkmute)]">Optional</span>
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
              <span className="mb-1.5 block text-sm text-[var(--inksoft)]">
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
              <p className="border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--edge)]" />
            <span className="text-xs text-[var(--inkmute)]">or</span>
            <div className="h-px flex-1 bg-[var(--edge)]" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={googleBusy}
            className="btn-ghost mt-6 w-full gap-3 disabled:cursor-wait disabled:opacity-60"
          >
            <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
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
