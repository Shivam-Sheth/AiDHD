"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAnySession } from "@/lib/groups/client-session";

/**
 * Client-side protected-route wrapper. Sessions live in the browser
 * (Supabase JWT or demo local user), so the guard runs client-side and
 * bounces signed-out visitors to /login with a return path.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await hasAnySession();
      if (cancelled) return;
      if (!ok) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        return;
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="font-display text-sm text-muted">Checking session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
