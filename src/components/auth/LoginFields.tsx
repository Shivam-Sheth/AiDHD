"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const OAUTH_ERRORS: Record<string, string> = {
  google_oauth_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet.",
};

/**
 * Bare form fields + submit logic for LoginModal. Deliberately has no
 * dialog chrome of its own — kept separate so the modal's JSX doesn't
 * balloon with input markup.
 */
export function LoginFields({
  initialError = null,
  onSuccess,
}: {
  initialError?: string | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
    if (!supabase) {
      setError("Sign-in isn't configured — set SUPABASE_URL/SUPABASE_ANON_KEY.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

    let session = signInData.session;

    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
        {
          email: trimmedEmail,
          password,
          options: { data: { full_name: trimmedName } },
        },
      );
      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }
      // An empty identities array means the email is already registered —
      // Supabase returns a fake user (no error) here to avoid leaking which
      // emails exist, so this is the only way to tell it apart from a new signup.
      if (signUpData.user && signUpData.user.identities?.length === 0) {
        setError("That email is already registered — check your password.");
        setSubmitting(false);
        return;
      }
      session = signUpData.session;
      if (!session) {
        setError("Check your email to confirm your account, then sign in.");
        setSubmitting(false);
        return;
      }
    }

    if (!session) {
      setError("Could not sign in.");
      setSubmitting(false);
      return;
    }

    await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: phone.trim() || undefined }),
    }).catch(() => {});

    const { writeLocalGroupUser } = await import("@/lib/groups/client-session");
    writeLocalGroupUser({
      id: session.user.id,
      name: trimmedName || session.user.email?.split("@")[0] || "Member",
      email: session.user.email || trimmedEmail,
    });

    login();
    onSuccess?.();
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
    // On success the SDK redirects the browser to Google — nothing left to do here.
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-shadow)]"
            autoComplete="name"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-shadow)]"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-[var(--ink)]">
              Phone number
            </span>
            <span className="text-xs font-medium text-[var(--faint)]">
              Optional
            </span>
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-shadow)]"
            autoComplete="tel"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-shadow)]"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 font-display text-base font-semibold text-white shadow-md transition hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-medium tracking-wide text-[var(--faint)] uppercase">
          or
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={googleBusy}
        className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-6 py-3 font-display text-base font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-2)] disabled:cursor-wait disabled:opacity-60"
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
  );
}
