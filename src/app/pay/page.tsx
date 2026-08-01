"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SiteShell } from "@/components/site/SiteShell";

function PayInner() {
  const params = useSearchParams();
  const session = params.get("session");
  const iframe = params.get("iframe");

  return (
    <SiteShell
      compact
      links={[
        { href: "/agent", label: "Agent" },
        { href: "/app", label: "App" },
      ]}
    >
      <main className="mx-auto max-w-lg px-5 py-24">
        <h1 className="font-display text-3xl font-bold tracking-tight uppercase">
          Prava payment
        </h1>
        <p className="mt-2 text-[var(--inksoft)]">
          Complete passkey / card collect for session{" "}
          <code className="font-mono text-sm text-[var(--inkmute)]">
            {session || "—"}
          </code>
        </p>
        {iframe ? (
          <iframe
            title="Prava"
            src={decodeURIComponent(iframe)}
            className="surface mt-6 h-[480px] w-full"
          />
        ) : (
          <p className="mt-6 font-mono text-xs tracking-[0.12em] text-[var(--inkmute)] uppercase">
            Open this from the agent after create_payment — iframe URL attaches
            when Prava returns one.
          </p>
        )}
      </main>
    </SiteShell>
  );
}

export default function PayPage() {
  return (
    <Suspense>
      <PayInner />
    </Suspense>
  );
}
