"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function PayInner() {
  const params = useSearchParams();
  const session = params.get("session");
  const iframe = params.get("iframe");

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <Link href="/agent" className="text-sm text-teal-700">
        ← Concierge
      </Link>
      <h1 className="font-display mt-4 text-3xl font-bold">Prava payment</h1>
      <p className="mt-2 text-neutral-600">
        Complete passkey / card collect for session{" "}
        <code className="text-sm">{session || "—"}</code>
      </p>
      {iframe ? (
        <iframe
          title="Prava"
          src={decodeURIComponent(iframe)}
          className="mt-6 h-[480px] w-full rounded-xl border"
        />
      ) : (
        <p className="mt-6 text-sm text-neutral-500">
          Open this from the agent after create_payment — iframe URL attaches
          when Prava returns one.
        </p>
      )}
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
