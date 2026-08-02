"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  groupAuthHeaders,
  readLocalGroupUser,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [mode, setMode] = useState("");
  const [name, setName] = useState(() => readLocalGroupUser()?.name || "");
  const [email, setEmail] = useState(() => readLocalGroupUser()?.email || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/invite/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invite invalid");
        return;
      }
      setTitle(data.group.title);
      setPlace(data.group.place);
      setMode(data.group.mode);
    })();
  }, [token]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const local = readLocalGroupUser();
    writeLocalGroupUser({
      id:
        local?.id ||
        `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      name: name.trim(),
      email: email.trim(),
    });
    try {
      const headers = await groupAuthHeaders();
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not join");
        return;
      }
      router.push(`/groups/${data.group_id}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-16">
      <Link href="/" className="font-display text-xl font-bold text-ink">
        AiDHD
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">
        You&apos;re invited
      </h1>
      {title ? (
        <p className="mt-2 text-muted">
          {title}
          {place ? ` · ${place}` : ""}
          {mode ? ` · ${mode}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-muted">Loading invite…</p>
      )}

      <form onSubmit={join} className="mt-8 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
          required
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (for booking confirmations)"
          autoComplete="email"
          inputMode="email"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy || !title}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join group chat"}
        </button>
      </form>
      <p className="mt-6 text-center text-[11px] text-faint">
        Tip: Add AiDHD to your Home Screen for the full phone-app feel — invite
        friends next time from Share or Contacts.
      </p>
    </div>
  );
}
