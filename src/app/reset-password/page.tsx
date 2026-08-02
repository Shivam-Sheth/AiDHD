"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password reset — two stages on one page:
 * 1. Request: user enters email → Supabase sends a recovery link.
 * 2. Update: user lands here from the recovery link (PASSWORD_RECOVERY
 *    session) → sets a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Recovery links land with a session — detect it and switch to update.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("update");
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.hash.includes("type=recovery")) {
        setStage("update");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Password reset requires Supabase to be configured.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice("Check your inbox — we sent a password reset link.");
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Password updated — taking you to your groups…");
    setTimeout(() => router.replace("/groups"), 900);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas">
      <header className="mx-auto flex max-w-3xl items-baseline justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-ink transition-opacity hover:opacity-70"
        >
          AiDHD
        </Link>
        <Link
          href="/login"
          className="text-sm text-muted transition-colors hover:text-ink"
        >
          Back to sign in
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl justify-center px-5 pb-24 pt-14 sm:px-6">
        <div className="w-full max-w-sm animate-fade-in">
          <h1 className="font-display mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-ink">
            {stage === "request" ? "Reset password" : "Set a new password"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            {stage === "request"
              ? "Enter your email and we'll send you a reset link."
              : "Choose a new password for your account."}
          </p>

          {stage === "request" ? (
            <form onSubmit={requestReset} className="mt-10 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink shadow-sm outline-none transition placeholder:text-faint focus:border-ink focus:ring-2 focus:ring-ink/20"
                  autoComplete="email"
                  autoFocus
                />
              </label>

              {error && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink-700">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-6 py-3 font-display text-base font-semibold text-inverse shadow-card transition disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          ) : (
            <form onSubmit={updatePassword} className="mt-10 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  New password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink shadow-sm outline-none transition placeholder:text-faint focus:border-ink focus:ring-2 focus:ring-ink/20"
                  autoComplete="new-password"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  Confirm password
                </span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink shadow-sm outline-none transition placeholder:text-faint focus:border-ink focus:ring-2 focus:ring-ink/20"
                  autoComplete="new-password"
                />
              </label>

              {error && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink-700">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-6 py-3 font-display text-base font-semibold text-inverse shadow-card transition disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
