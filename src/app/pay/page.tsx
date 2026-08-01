"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";

function PayInner() {
  const params = useSearchParams();
  const session = params.get("session");
  const iframe = params.get("iframe");

  return (
    <main className="relative min-h-screen bg-[var(--void)] text-[var(--ink)]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 site-atmosphere"
        aria-hidden
      />
      <div className="mx-auto max-w-lg px-5 py-16">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/agent"
            className="text-sm text-[var(--inkmute)] transition-colors hover:text-[var(--ink)]"
          >
            ← Concierge
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Prava payment
        </h1>
        <p className="mt-2 text-[var(--inksoft)]">
          Complete passkey / card collect for session{" "}
          <code className="text-sm text-[var(--inkmute)]">
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
          <p className="mt-6 text-sm text-[var(--inkmute)]">
            Open this from the agent after create_payment — iframe URL attaches
            when Prava returns one.
          </p>
        )}
      </div>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense>
      <PayInner />
    </Suspense>
  );
}
