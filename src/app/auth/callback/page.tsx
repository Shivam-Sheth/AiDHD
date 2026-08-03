"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (!supabase) {
        router.replace("/?login_error=google_not_configured");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        router.replace("/?login_error=google_oauth_failed");
        return;
      }

      await fetch("/api/auth/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => {});

      // Mirror into the local group session so group APIs work in both modes.
      try {
        const { writeLocalGroupUser } = await import(
          "@/lib/groups/client-session"
        );
        const u = data.session.user;
        const meta = u.user_metadata as
          | { full_name?: string; name?: string }
          | undefined;
        writeLocalGroupUser({
          id: u.id,
          name:
            meta?.full_name || meta?.name || u.email?.split("@")[0] || "Member",
          email: u.email || "",
        });
      } catch {
        // non-fatal
      }

      // Land on the app home after email confirm / OAuth — not /agent.
      if (!cancelled) router.replace("/");
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="font-display text-sm text-muted">
        Finishing sign-in…
      </p>
    </main>
  );
}
