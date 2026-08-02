"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PassportGate } from "@/components/vault/PassportGate";
import {
  readLocalGroupUser,
  signOutEverywhere,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";

/**
 * Optional vault management — NOT part of login.
 * Passports are collected at flight-book time via PassportGate.
 */
export default function AccountPage() {
  return (
    <AuthGuard>
      <AccountPageInner />
    </AuthGuard>
  );
}

function AccountPageInner() {
  const router = useRouter();
  const local = readLocalGroupUser();
  const [name, setName] = useState(local?.name || "");
  const [email, setEmail] = useState(local?.email || "");
  const [present, setPresent] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<{
    connected: boolean;
    email: string;
  } | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [sms, setSms] = useState<{
    linked: boolean;
    pending: boolean;
    phone_last4: string | null;
    linq_number: string | null;
  } | null>(null);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsInstructions, setSmsInstructions] = useState<string | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);

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
    void (async () => {
      const { groupAuthHeaders } = await import("@/lib/groups/client-session");
      const headers = await groupAuthHeaders();
      const [cal, smsRes] = await Promise.all([
        fetch("/api/calendar/status", { headers }),
        fetch("/api/sms/link", { headers }),
      ]);
      if (cal.ok) setCalendar(await cal.json());
      if (smsRes.ok) setSms(await smsRes.json());
    })();
  }, []);

  async function connectCalendar() {
    setCalendarBusy(true);
    try {
      const { groupAuthHeaders } = await import("@/lib/groups/client-session");
      const headers = await groupAuthHeaders();
      const res = await fetch("/api/calendar/oauth/start", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.ok) {
        setCalendar({ connected: true, email: email || "demo" });
        setMsg(data.message || "Calendar connected.");
      }
    } finally {
      setCalendarBusy(false);
    }
  }

  async function startSmsLinking(e: React.FormEvent) {
    e.preventDefault();
    if (!smsPhone.trim()) return;
    setSmsBusy(true);
    setSmsInstructions(null);
    try {
      const { groupAuthHeaders } = await import("@/lib/groups/client-session");
      const headers = await groupAuthHeaders();
      const res = await fetch("/api/sms/link", {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: smsPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmsInstructions(data.error || "Could not start linking.");
        return;
      }
      setSmsInstructions(data.instructions);
      setSms((prev) => ({
        linked: false,
        pending: true,
        phone_last4: data.phone_last4,
        linq_number: data.linq_number ?? prev?.linq_number ?? null,
      }));
    } finally {
      setSmsBusy(false);
    }
  }

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

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Google Calendar</p>
        <p className="mt-1 text-xs text-muted">
          {calendar?.connected ? (
            <span className="text-success">
              Connected{calendar.email ? ` · ${calendar.email}` : ""} — Prava
              can add plans after you approve each one.
            </span>
          ) : (
            "Connect so confirmed plans, reservations, and flights can be added to your calendar (with your approval each time)."
          )}
        </p>
        {!calendar?.connected && (
          <button
            type="button"
            onClick={() => void connectCalendar()}
            disabled={calendarBusy}
            className="mt-3 w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {calendarBusy ? "Connecting…" : "Connect Google Calendar"}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Text Prava (SMS)</p>
        {sms?.linked ? (
          <p className="mt-1 text-xs text-success">
            Linked to ···{sms.phone_last4} — text{" "}
            {sms.linq_number || "the Prava number"} things like &ldquo;book a
            table for 4 tomorrow 8pm&rdquo;.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted">
              Link your phone to book, buy, and reserve over text. We verify
              with a code — no payment details ever go over SMS.
            </p>
            <form onSubmit={startSmsLinking} className="mt-3 flex gap-2">
              <input
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                inputMode="tel"
                autoComplete="tel"
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={smsBusy || !smsPhone.trim()}
                className="shrink-0 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-inverse disabled:opacity-50"
              >
                {smsBusy ? "…" : sms?.pending ? "Resend code" : "Link"}
              </button>
            </form>
            {smsInstructions && (
              <p className="mt-2 text-xs text-ink-700">{smsInstructions}</p>
            )}
          </>
        )}
      </div>

      {msg && <p className="mt-4 text-sm text-success">{msg}</p>}

      <button
        type="button"
        onClick={() => {
          void signOutEverywhere().then(() => router.replace("/login"));
        }}
        className="mt-8 w-full rounded-xl border border-line py-3 text-sm font-semibold text-ink-700 transition hover:border-danger/40 hover:text-danger"
      >
        Sign out
      </button>
    </div>
  );
}
