"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DebugLogEntry } from "@/lib/checkout/debug-log";

const TAG_COLORS: Record<string, string> = {
  prava: "text-amber-300",
  duffel: "text-sky-300",
  poll: "text-violet-300",
  "checkout execute": "text-emerald-300",
  "prava complete": "text-emerald-300",
};

export default function DebugPage() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/checkout/debug-stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const entry = JSON.parse(ev.data) as DebugLogEntry;
        setEntries((prev) => [...prev, entry].slice(-500));
      } catch {
        // Ignore malformed frames rather than break the stream.
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, autoScroll]);

  return (
    <main className="flex h-screen flex-col bg-[#0b0f14] text-white/90">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/agent" className="text-xs text-white/50 hover:text-white/80">
            ← Concierge
          </Link>
          <h1 className="font-display text-sm font-semibold">Checkout debug console</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={connected ? "text-emerald-400" : "text-red-400"}>
            {connected ? "● live" : "● disconnected"}
          </span>
          <label className="flex items-center gap-1.5 text-white/60">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            autoscroll
          </label>
          <button
            type="button"
            onClick={() => setEntries([])}
            className="rounded-md border border-white/15 px-2 py-1 text-white/70 hover:bg-white/5"
          >
            Clear
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {entries.length === 0 && (
          <p className="text-white/40">Waiting for checkout activity — approve a Prava payment to see it here.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="mb-1.5">
            <span className="text-white/35">{e.ts.slice(11, 23)}</span>{" "}
            <span className={TAG_COLORS[e.tag] || "text-white/70"}>[{e.tag}]</span>{" "}
            <span className="text-white/90">{e.message}</span>
            {e.data !== undefined && (
              <pre className="mt-0.5 ml-4 whitespace-pre-wrap break-all text-white/45">
                {JSON.stringify(e.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}
