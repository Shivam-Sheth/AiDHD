"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasAnySession } from "@/lib/groups/client-session";

/**
 * Client-side protected-route wrapper — gates on the shared auth state from
 * @/components/auth/AuthProvider (mounted at the root) so it reuses the one
 * login modal instead of routing to /login, which no longer exists (see
 * AuthProvider's own note on why there's no standalone login page). Also
 * accepts an existing group-platform session (Supabase JWT or demo local
 * user) so a visitor who already has one isn't asked to sign in twice.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loggedIn, openLogin } = useAuth();
  const [hasGroupSession, setHasGroupSession] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasAnySession().then((ok) => {
      if (cancelled) return;
      setHasGroupSession(ok);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const authed = loggedIn || hasGroupSession;

  useEffect(() => {
    if (checked && !authed) openLogin();
  }, [checked, authed, openLogin]);

  if (!checked || !authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="font-display text-sm text-[var(--muted)]">
          {checked ? "Sign in to continue…" : "Checking session…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
