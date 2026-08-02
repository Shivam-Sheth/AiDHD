"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  groupAuthHeaders,
  readLocalGroupUser,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";
import type { GroupParty } from "@/lib/groups/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupParty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const local = readLocalGroupUser();
    if (local) {
      setName(local.name);
      setEmail(local.email);
      setHasSession(true);
    }
    void (async () => {
      const headers = await groupAuthHeaders();
      if (!("Authorization" in headers) && !("x-aidhd-user-id" in headers)) {
        setReady(true);
        return;
      }
      setHasSession(true);
      const res = await fetch("/api/groups", { headers });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      } else if (res.status === 401) {
        setError(null);
      } else {
        setError("Could not load groups");
      }
      setReady(true);
    })();
  }, []);

  async function ensureSession(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id =
      readLocalGroupUser()?.id ||
      `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    writeLocalGroupUser({
      id,
      name: name.trim(),
      email: email.trim(),
    });
    setHasSession(true);
    const headers = await groupAuthHeaders();
    const res = await fetch("/api/groups", { headers });
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
      setError(null);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← AiDHD
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">
            Your parties
          </h1>
          <p className="mt-1 text-sm text-muted">
            Host a group, invite friends, tag @AiDHD in chat.
          </p>
        </div>
        <Link
          href="/groups/new"
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink"
        >
          New party
        </Link>
      </div>

      {!hasSession && ready && (
        <form
          onSubmit={ensureSession}
          className="mb-8 space-y-3 rounded-xl border border-line bg-surface p-4"
        >
          <p className="text-sm text-ink-800">
            Quick session (or{" "}
            <Link href="/login" className="text-accent underline">
              Google sign-in
            </Link>
            )
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            required
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-inverse"
          >
            Continue
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {ready && groups.length === 0 && (
        <p className="text-sm text-muted">No parties yet — create one.</p>
      )}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.id}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-accent/50"
            >
              <p className="font-semibold text-ink">{g.title}</p>
              <p className="text-xs text-muted">
                {g.mode} · {g.place} · {g.status}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-center text-xs text-faint">
        <Link href="/account" className="hover:text-ink">
          Account
        </Link>
      </p>
    </div>
  );
}
