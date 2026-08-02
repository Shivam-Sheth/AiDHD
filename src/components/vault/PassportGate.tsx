"use client";

import { useState } from "react";
import {
  readLocalGroupUser,
  writeLocalGroupUser,
} from "@/lib/groups/client-session";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with vault ready (remembered or one-time session handled server-side). */
  onReady: (result: {
    remembered: boolean;
    user_id: string;
  }) => void;
  contextLabel?: string;
  /** Force vault write for this user (private collect links). */
  forcedUserId?: string;
  forcedDisplayName?: string;
};

/**
 * Shown only when booking flights — never at login.
 * Ask: remember encrypted? or use once?
 */
export function PassportGate({
  open,
  onClose,
  onReady,
  contextLabel = "to issue your ticket",
  forcedUserId,
  forcedDisplayName,
}: Props) {
  const [passport, setPassport] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const number = passport.trim();
    if (!number || number.length < 5) {
      setError("Enter a valid passport number.");
      return;
    }
    setBusy(true);
    setError(null);

    let user = readLocalGroupUser();
    if (!user) {
      user = {
        id:
          forcedUserId ||
          `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
        name: forcedDisplayName || "Traveler",
        email: "",
      };
      writeLocalGroupUser(user);
    }
    const userId = forcedUserId || user.id;
    const displayName = forcedDisplayName || user.name;

    try {
      if (remember) {
        const res = await fetch("/api/vault/passport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            passport_number: number,
            display_name: displayName,
            email: user.email,
            remember: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save encrypted passport");
          return;
        }
        sessionStorage.removeItem("aidhd_passport_once");
      } else {
        // One-time: stay in sessionStorage only — never vault
        sessionStorage.setItem(
          "aidhd_passport_once",
          JSON.stringify({ user_id: userId, passport_number: number }),
        );
        await fetch("/api/vault/passport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            passport_number: number,
            display_name: displayName,
            email: user.email,
            remember: false,
          }),
        }).catch(() => null);
      }
      onReady({ remembered: remember, user_id: userId });
      setPassport("");
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="passport-gate-title"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-lifted"
      >
        <h2
          id="passport-gate-title"
          className="font-display text-xl font-bold text-ink"
        >
          Passport for this flight
        </h2>
        <p className="mt-1 text-sm text-muted">
          Needed {contextLabel}. Never asked at login. Never spoken to the AI —
          only sent over HTTPS to our vault.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            value={passport}
            onChange={(e) => setPassport(e.target.value)}
            placeholder="Passport number"
            autoComplete="off"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-sm text-ink"
            required
          />

          <fieldset className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10">
              <input
                type="radio"
                name="remember"
                checked={remember}
                onChange={() => setRemember(true)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-ink">Remember encrypted</span>
                <span className="mt-0.5 block text-xs text-muted">
                  AES-GCM in your traveler vault. Next flight skips this step.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10">
              <input
                type="radio"
                name="remember"
                checked={!remember}
                onChange={() => setRemember(false)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-ink">Use once</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Only for this booking — not stored in the vault.
                </span>
              </span>
            </label>
          </fieldset>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm text-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
