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
        router.replace("/login?error=google_not_configured");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        router.replace("/login?error=google_oauth_failed");
        return;
      }

      await fetch("/api/auth/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => {});

      if (!cancelled) router.replace("/agent");
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="font-display text-sm text-neutral-500">
        Finishing sign-in…
      </p>
    </main>
  );
}
