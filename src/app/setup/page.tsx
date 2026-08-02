"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SetupPage() {
  const [status, setStatus] = useState<"checking" | "ok" | "missing">(
    "checking",
  );
  const [detail, setDetail] = useState("");

  async function probe() {
    setStatus("checking");
    try {
      const res = await fetch("/api/setup/status");
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        setDetail("profiles + traveler_profiles + groups are live.");
      } else {
        setStatus("missing");
        setDetail(data.message || "Tables missing — run ALL.sql");
      }
    } catch {
      setStatus("missing");
      setDetail("Could not reach API");
    }
  }

  useEffect(() => {
    void probe();
  }, []);

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <Link href="/groups" className="text-sm text-muted hover:text-ink">
        ← Parties
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        Supabase setup
      </h1>
      <p className="mt-2 text-sm text-muted">
        Personal project:{" "}
        <code className="text-xs text-ink-700">fbjlmtxfdzrlfsbbyxss</code>
      </p>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-ink-800">
        <li>
          Open{" "}
          <a
            className="text-accent underline"
            href="https://supabase.com/dashboard/project/fbjlmtxfdzrlfsbbyxss/sql/new"
            target="_blank"
            rel="noreferrer"
          >
            SQL editor
          </a>
        </li>
        <li>
          Paste everything from{" "}
          <code className="text-xs">supabase/ALL.sql</code> → Run
        </li>
        <li>Auth → Providers → Google (same OAuth client as this app)</li>
        <li>
          Redirect URI:{" "}
          <code className="break-all text-xs">
            https://fbjlmtxfdzrlfsbbyxss.supabase.co/auth/v1/callback
          </code>
        </li>
        <li>Click Recheck below</li>
      </ol>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
        Status:{" "}
        {status === "checking"
          ? "checking…"
          : status === "ok"
            ? "ready"
            : "needs SQL"}
        <p className="mt-1 text-xs text-muted">{detail}</p>
        <button
          type="button"
          onClick={() => void probe()}
          className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink"
        >
          Recheck
        </button>
      </div>
    </div>
  );
}
