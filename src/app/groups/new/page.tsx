"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  groupAuthHeaders,
  readLocalGroupUser,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";
import { AuthGuard } from "@/components/AuthGuard";
import type { GroupMode } from "@/lib/groups/types";

export default function NewGroupPage() {
  return (
    <AuthGuard>
      <NewGroupPageInner />
    </AuthGuard>
  );
}

function NewGroupPageInner() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [mode, setMode] = useState<GroupMode>("outing");
  const [dates, setDates] = useState("");
  const [name, setName] = useState(() => readLocalGroupUser()?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);

    let local = readLocalGroupUser();
    if (!local) {
      local = {
        id: `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
        name: name.trim(),
        email: "",
      };
      writeLocalGroupUser(local);
    } else if (local.name !== name.trim()) {
      writeLocalGroupUser({ ...local, name: name.trim() });
    }

    try {
      const headers = await groupAuthHeaders();
      const res = await fetch("/api/groups", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          place: place.trim() || "TBD",
          mode,
          proposed_dates: dates
            .split(/[,\s]+/)
            .map((d) => d.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create");
        return;
      }
      router.push(`/groups/${data.group.id}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <Link href="/groups" className="text-sm text-muted hover:text-ink">
        ← Parties
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        Host a party
      </h1>
      <p className="mt-1 text-sm text-muted">
        Like Partiful — with AiDHD in the group chat to plan and book.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-muted">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday in Brooklyn"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Place / city</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Chicago"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>
        <fieldset className="text-sm">
          <legend className="text-muted">Mode</legend>
          <div className="mt-2 flex gap-3">
            {(["outing", "trip"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border px-3 py-2 capitalize ${
                  mode === m
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line text-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="text-muted">Dates (YYYY-MM-DD, optional)</span>
          <input
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder="2026-08-14, 2026-08-15"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create group chat"}
        </button>
      </form>
    </div>
  );
}
