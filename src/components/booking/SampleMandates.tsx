"use client";

import { useEffect, useState } from "react";

type Mandate = {
  category: string;
  merchant: string;
  amount_cap: number;
  status: string;
  mode: string;
  mandate_id: string;
  collect_url?: string;
  error?: string;
  duration_minutes: number;
};

export function SampleMandates() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/prava/sample-mandates");
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not load mandates");
        setMandates([]);
      } else {
        setMandates(data.mandates || []);
        setNote(data.note || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
            Prava · sample mandates
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Live sandbox Collect sessions (one per category). In Prava the
            session + passkey approval is the mandate scope.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-ink hover:border-ink disabled:opacity-50"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {note && !error && (
        <p className="mt-3 text-[11px] leading-relaxed text-faint">{note}</p>
      )}

      <ul className="mt-3 space-y-2">
        {mandates.map((m) => (
          <li
            key={m.mandate_id}
            className="rounded-2xl border border-line bg-canvas px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-sm font-semibold capitalize text-ink">
                  {m.category}
                </p>
                <p className="mt-0.5 text-xs text-muted">{m.merchant}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-base font-bold text-ink">
                  ${m.amount_cap}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-success">
                  {m.status} · {m.mode}
                </p>
              </div>
            </div>
            <p className="mt-2 break-all font-mono text-[10px] text-faint">
              mandate / session · {m.mandate_id}
            </p>
            <p className="mt-0.5 text-[10px] text-faint">
              Cap duration · {m.duration_minutes} min
            </p>
            {m.collect_url && (
              <a
                href={m.collect_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-ink underline-offset-2 hover:underline"
              >
                Open Collect →
              </a>
            )}
            {m.error && (
              <p className="mt-1 text-xs text-danger">{m.error}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
