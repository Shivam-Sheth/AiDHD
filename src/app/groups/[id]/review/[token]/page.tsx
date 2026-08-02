"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PassportGate } from "@/components/vault/PassportGate";
import { groupAuthHeaders } from "@/lib/groups/client-session";
import type { GroupBookingDraft, TravelerSlot } from "@/lib/groups/types";

type TravelerRow = TravelerSlot & { collect_url?: string | null };

export default function BookingReviewPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const [draft, setDraft] = useState<GroupBookingDraft | null>(null);
  const [travelers, setTravelers] = useState<TravelerRow[]>([]);
  const [title, setTitle] = useState("");
  const [spoc, setSpoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<
    Array<{ display_name: string; collect_url: string | null }>
  >([]);
  const [pravaUrl, setPravaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/groups/review/${token}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Not found");
      return;
    }
    setDraft(data.draft);
    setTravelers(data.draft?.travelers || []);
    setTitle(data.group?.title || "");
    setSpoc(data.group?.spoc_user_id || null);
  }

  useEffect(() => {
    void reload();
  }, [token]);

  async function postAction(action: "approve" | "book") {
    setBusy(true);
    setError(null);
    setLinks([]);
    try {
      const headers = await groupAuthHeaders();
      const res = await fetch(`/api/groups/review/${token}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.links)) setLinks(data.links);
        if (/passport/i.test(String(data.error || ""))) {
          setPassportOpen(true);
        }
        setError(data.error || "Request failed");
        return;
      }
      setDraft(data.draft);
      if (data.draft?.travelers) setTravelers(data.draft.travelers);
      if (data.prava?.iframe_url) setPravaUrl(data.prava.iframe_url);
      if (data.booking?.confirmation_id) {
        setConfirmation(data.booking.confirmation_id);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !draft) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-danger">
        {error}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">
        Loading review…
      </div>
    );
  }

  const missing = travelers.filter(
    (t) => t.needs_passport && !t.passport_present,
  );
  const allPassportsReady =
    !travelers.some((t) => t.needs_passport) || missing.length === 0;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <PassportGate
        open={passportOpen}
        onClose={() => setPassportOpen(false)}
        onReady={() => {
          setError(null);
          void reload();
        }}
        contextLabel="before you approve this flight booking"
      />
      <Link
        href={`/groups/${id}`}
        className="text-sm text-muted hover:text-ink"
      >
        ← Back to chat
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        Review booking
      </h1>
      <p className="mt-1 text-sm text-muted">{title}</p>
      <p className="mt-2 text-xs text-faint">
        One order · {draft.party_size} travelers. Passports stay in private
        vaults — never posted in chat.
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-800">
          <span className="text-muted">Category · </span>
          {draft.category}
        </p>
        <p className="text-sm text-ink-800">
          <span className="text-muted">Summary · </span>
          {String(draft.offer.summary || "—")}
        </p>
        <p className="text-sm text-ink-800">
          <span className="text-muted">Amount · </span>$
          {Number(draft.offer.amount ?? 0) || "TBD"}
        </p>
        <p className="text-sm text-ink-800">
          <span className="text-muted">SPOC · </span>
          {spoc || "not set (needed for dining/tickets)"}
        </p>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Travelers
          </p>
          <ul className="space-y-2">
            {travelers.map((t) => (
              <li key={t.user_id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{t.display_name}</span>
                  {t.needs_passport ? (
                    <span
                      className={
                        t.passport_present ? "text-success" : "text-warning"
                      }
                    >
                      {t.passport_present ? "ready ✓" : "needs passport"}
                    </span>
                  ) : (
                    <span className="text-faint">name only</span>
                  )}
                </div>
                {t.needs_passport && !t.passport_present && t.collect_url ? (
                  <a
                    href={t.collect_url}
                    className="mt-1 inline-block text-xs text-accent underline"
                  >
                    Private passport link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {links.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
          <p className="font-medium text-ink">Send these private links:</p>
          <ul className="mt-2 space-y-1">
            {links.map((l) => (
              <li key={l.display_name}>
                {l.display_name}:{" "}
                {l.collect_url ? (
                  <a href={l.collect_url} className="text-accent underline break-all">
                    {l.collect_url}
                  </a>
                ) : (
                  "—"
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmation && (
        <p className="mt-4 text-sm text-success">
          Booked · {confirmation}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void postAction("approve")}
        disabled={
          busy ||
          !allPassportsReady ||
          draft.status === "booked" ||
          draft.status === "awaiting_payment"
        }
        className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-50"
      >
        {draft.status === "awaiting_payment"
          ? "Approved — complete Prava"
          : draft.status === "booked"
            ? "Booked"
            : !allPassportsReady
              ? `Waiting on ${missing.length} passport${missing.length === 1 ? "" : "s"}`
              : busy
                ? "Approving…"
                : "Approve & generate Prava mandate"}
      </button>

      {pravaUrl && (
        <a
          href={pravaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block w-full rounded-xl border border-line py-3 text-center text-sm font-semibold text-ink"
        >
          Open Prava Collect
        </a>
      )}

      {(draft.status === "awaiting_payment" || pravaUrl) &&
        allPassportsReady &&
        draft.status !== "booked" && (
          <button
            type="button"
            onClick={() => void postAction("book")}
            disabled={busy}
            className="mt-3 w-full rounded-xl border border-accent py-3 text-sm font-semibold text-accent disabled:opacity-50"
          >
            {busy ? "Issuing…" : "Issue tickets (one order · vault passports)"}
          </button>
        )}
    </div>
  );
}
