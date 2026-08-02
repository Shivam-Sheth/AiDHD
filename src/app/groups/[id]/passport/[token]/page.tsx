"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Private passport collect page — opened from a personal link in group chat.
 * Numbers never return to chat; only ✓ ready / still waiting.
 */
export default function PassportCollectPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [already, setAlready] = useState(false);
  const [passport, setPassport] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    all_ready: boolean;
    still_missing: string[];
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/groups/passport/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Link invalid");
        return;
      }
      setName(data.traveler?.display_name || "Traveler");
      setTitle(data.group?.title || "");
      setSummary(data.summary || "");
      setAlready(Boolean(data.traveler?.passport_present));
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/passport/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_number: passport.trim(),
          remember,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setPassport("");
      setDone({
        all_ready: Boolean(data.all_ready),
        still_missing: data.still_missing || [],
      });
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !name && !done) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-danger">
        {error}
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto min-h-screen max-w-lg px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Saved privately</h1>
        <p className="mt-2 text-sm text-muted">
          Your passport stays in the vault — it was not posted to the group chat.
        </p>
        {done.all_ready ? (
          <p className="mt-4 text-sm text-success">
            Everyone&apos;s ready. Host can approve &amp; pay for one order.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Still waiting on: {done.still_missing.join(", ")}
          </p>
        )}
        <Link
          href={`/groups/${id}`}
          className="mt-8 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
        >
          Back to group
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <Link href={`/groups/${id}`} className="text-sm text-muted hover:text-ink">
        ← Back to chat
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        Your passport
      </h1>
      <p className="mt-1 text-sm text-muted">
        {name}
        {title ? ` · ${title}` : ""}
      </p>
      {summary ? (
        <p className="mt-2 text-sm text-ink-800">{summary}</p>
      ) : null}
      <p className="mt-3 text-xs text-faint">
        This page is only for you. The group chat will only see that you&apos;re
        ready — never the number. One order books everyone&apos;s tickets from
        vault passports.
      </p>

      {already && !done ? (
        <p className="mt-4 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-success">
          Passport already on file. You can update it below if needed.
        </p>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
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
                AES-GCM in your traveler vault.
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
                Held only for this booking (~30 min).
              </span>
            </span>
          </label>
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save privately"}
        </button>
      </form>
    </div>
  );
}
