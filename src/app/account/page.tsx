"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PassportGate } from "@/components/vault/PassportGate";
import {
  readLocalGroupUser,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";

/**
 * Optional vault management — NOT part of login.
 * Passports are collected at flight-book time via PassportGate.
 */
export default function AccountPage() {
  const local = readLocalGroupUser();
  const [name, setName] = useState(local?.name || "");
  const [email, setEmail] = useState(local?.email || "");
  const [present, setPresent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const user = readLocalGroupUser();
      if (!user) return;
      const res = await fetch(
        `/api/vault/passport?user_id=${encodeURIComponent(user.id)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setPresent(Boolean(data.ref?.present));
      }
    })();
  }, []);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const user = readLocalGroupUser() || {
      id: `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      name: "Traveler",
      email: "",
    };
    writeLocalGroupUser({
      ...user,
      name: name.trim() || user.name,
      email: email.trim() || user.email,
    });
    setMsg("Profile saved on this device.");
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-10">
      <PassportGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onReady={({ remembered }) => {
          setPresent(true);
          setMsg(
            remembered
              ? "Passport encrypted in your vault."
              : "One-time passport ready for the next booking only.",
          );
        }}
      />

      <Link href="/groups" className="text-sm text-muted hover:text-ink">
        ← Parties
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">Account</h1>
      <p className="mt-1 text-sm text-muted">
        Login never asks for a passport. We only need it when you book a flight
        — you choose remember (encrypted) or use once.
      </p>

      <form onSubmit={saveProfile} className="mt-8 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          autoComplete="name"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-ink py-3 text-sm font-semibold text-inverse"
        >
          Save profile
        </button>
      </form>

      <div className="mt-8 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Flight passport vault</p>
        <p className="mt-1 text-xs text-muted">
          Status:{" "}
          {present ? (
            <span className="text-success">on file (encrypted)</span>
          ) : (
            <span className="text-faint">empty — fine until you book</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setGateOpen(true)}
          className="mt-3 w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-semibold text-ink"
        >
          {present ? "Update passport" : "Add passport (optional)"}
        </button>
      </div>

      {msg && <p className="mt-4 text-sm text-success">{msg}</p>}
    </div>
  );
}
