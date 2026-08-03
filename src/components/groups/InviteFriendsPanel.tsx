"use client";

import { useMemo, useState } from "react";
import { groupAuthHeaders } from "@/lib/groups/client-session";
import {
  contactsApiAvailable,
  normalizePhone,
  pickContactsFromDevice,
  shareInviteLink,
  smsInviteHref,
  whatsappShareHref,
  type PickedContact,
} from "@/lib/groups/invite-share";

type Props = {
  groupId: string;
  groupTitle?: string;
  onInvited?: () => void;
};

export function InviteFriendsPanel({
  groupId,
  groupTitle = "my party",
  onInvited,
}: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedContact[]>([]);
  const [manualPhones, setManualPhones] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [directTarget, setDirectTarget] = useState("");
  const canContacts = useMemo(() => contactsApiAvailable(), []);

  const allPhones = useMemo(() => {
    const fromManual = manualPhones
      .split(/[\n,;]+/)
      .map((p) => normalizePhone(p.trim()))
      .filter(Boolean);
    const fromPicked = picked.map((p) => p.phone);
    return [...new Set([...fromPicked, ...fromManual])];
  }, [manualPhones, picked]);

  const allNames = useMemo(() => {
    return picked.map((p) => p.name);
  }, [picked]);

  async function ensureInviteUrl(): Promise<string | null> {
    if (inviteUrl) return inviteUrl;
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/invite`, {
      method: "POST",
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create invite link");
      return null;
    }
    setInviteUrl(data.invite_url);
    return data.invite_url as string;
  }

  async function shareLink() {
    setBusy("share");
    setError(null);
    setStatus(null);
    try {
      const url = await ensureInviteUrl();
      if (!url) return;
      const result = await shareInviteLink({
        url,
        title: `Pact · ${groupTitle}`,
        text: `You're invited to "${groupTitle}" on Pact — join the group chat and we'll plan + book together.`,
      });
      if (result === "shared") setStatus("Shared via your phone’s share sheet.");
      else if (result === "copied")
        setStatus("Invite link copied — paste into Messages, WhatsApp, IG…");
      onInvited?.();
    } catch {
      setError("Share failed");
    } finally {
      setBusy(null);
    }
  }

  async function pickFromContacts() {
    setBusy("contacts");
    setError(null);
    setStatus(null);
    try {
      const list = await pickContactsFromDevice();
      if (!list.length) {
        setStatus("No phone numbers in the contacts you picked.");
        return;
      }
      setPicked((prev) => {
        const map = new Map(prev.map((p) => [p.phone, p]));
        for (const c of list) map.set(c.phone, c);
        return [...map.values()];
      });
      setStatus(`Added ${list.length} from Contacts.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Contacts unavailable");
    } finally {
      setBusy(null);
    }
  }

  function removePicked(phone: string) {
    setPicked((prev) => prev.filter((p) => p.phone !== phone));
  }

  async function inviteChannel(channel: "whatsapp" | "imessage") {
    if (!allPhones.length) {
      setError("Pick contacts or add a phone number first.");
      return;
    }
    setBusy(channel);
    setError(null);
    setStatus(null);
    try {
      const headers = await groupAuthHeaders();
      const path =
        channel === "imessage"
          ? `/api/groups/${groupId}/channels/linq`
          : `/api/groups/${groupId}/channels/whatsapp`;
      const res = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify({ phones: allPhones, names: allNames }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `${channel} invite failed`);
        return;
      }
      if (data.invite_url) setInviteUrl(data.invite_url);
      setStatus(
        `${channel === "whatsapp" ? "WhatsApp" : "iMessage"} invite sent. ${data.tip || ""}`,
      );
      onInvited?.();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  /** Invite by email, phone, or @username in one box. */
  async function inviteDirect() {
    const target = directTarget.trim();
    if (!target) return;
    setBusy("direct");
    setError(null);
    setStatus(null);
    try {
      const headers = await groupAuthHeaders();
      const body: Record<string, string> = {};
      if (target.includes("@") && target.includes(".")) body.email = target;
      else if (/^\+?[\d\s().-]{7,}$/.test(target)) body.phone = target;
      else body.username = target.replace(/^@/, "");

      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invite failed");
        return;
      }
      if (data.invite_url) setInviteUrl(data.invite_url);
      if (data.member) {
        setStatus(`${data.member.display_name} was added to the group.`);
      } else if (data.texted) {
        setStatus("Invite texted to that number.");
      } else if (data.notified) {
        setStatus("They already have an account — invite sent in-app.");
      } else if (data.mailto) {
        window.location.href = data.mailto;
        setStatus("Personal invite link created — email draft opened.");
      } else {
        setStatus("Personal invite link created.");
      }
      setDirectTarget("");
      onInvited?.();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function openSmsComposer() {
    setBusy("sms");
    setError(null);
    try {
      const url = await ensureInviteUrl();
      if (!url) return;
      window.location.href = smsInviteHref(url, allPhones);
      setStatus("Opened Messages with your invite link.");
      onInvited?.();
    } finally {
      setBusy(null);
    }
  }

  async function openWhatsAppShare() {
    setBusy("wa-share");
    setError(null);
    try {
      const url = await ensureInviteUrl();
      if (!url) return;
      const phone = allPhones[0];
      window.open(whatsappShareHref(url, phone), "_blank", "noopener");
      setStatus(
        phone
          ? "Opened WhatsApp for that contact with your link."
          : "Opened WhatsApp share with your invite link.",
      );
      onInvited?.();
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
      >
        Invite friends
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-3 text-left shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Invite friends</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => void shareLink()}
          disabled={busy !== null}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy === "share" ? "…" : "Share invite link"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void openSmsComposer()}
            disabled={busy !== null}
            className="rounded-lg border border-line py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            Text / iMessage
          </button>
          <button
            type="button"
            onClick={() => void openWhatsAppShare()}
            disabled={busy !== null}
            className="rounded-lg border border-line py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            WhatsApp link
          </button>
        </div>

        {canContacts ? (
          <button
            type="button"
            onClick={() => void pickFromContacts()}
            disabled={busy !== null}
            className="w-full rounded-lg border border-accent/40 bg-accent/10 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            {busy === "contacts" ? "Opening…" : "Add from Contacts"}
          </button>
        ) : (
          <p className="text-[10px] leading-snug text-faint">
            On iPhone: use <strong className="font-medium text-muted">Share invite link</strong>{" "}
            or Text — Apple doesn’t allow web apps to open the full Contacts
            picker. Android Chrome supports Add from Contacts.
          </p>
        )}
      </div>

      {picked.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {picked.map((c) => (
            <li key={c.phone}>
              <button
                type="button"
                onClick={() => removePicked(c.phone)}
                className="rounded-full border border-line bg-subtle px-2.5 py-1 text-[11px] text-ink-700"
                title="Remove"
              >
                {c.name} · {c.phone} ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <label className="block text-xs text-muted">
          Invite by email, phone, or @username
          <div className="mt-1 flex gap-1.5">
            <input
              value={directTarget}
              onChange={(e) => setDirectTarget(e.target.value)}
              placeholder="friend@email.com · +1555… · @handle"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void inviteDirect();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void inviteDirect()}
              disabled={busy !== null || !directTarget.trim()}
              className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-inverse disabled:opacity-50"
            >
              {busy === "direct" ? "…" : "Invite"}
            </button>
          </div>
        </label>
      </div>

      <label className="mt-3 block text-xs text-muted">
        Or paste phones
        <textarea
          value={manualPhones}
          onChange={(e) => setManualPhones(e.target.value)}
          rows={2}
          placeholder="+17735551212"
          inputMode="tel"
          autoComplete="tel"
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-2 py-1.5 font-mono text-xs text-ink"
        />
      </label>

      {allPhones.length > 0 && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void inviteChannel("whatsapp")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-ink py-2 text-xs font-semibold text-inverse disabled:opacity-50"
          >
            {busy === "whatsapp" ? "…" : "Send via Pact WhatsApp"}
          </button>
          <button
            type="button"
            onClick={() => void inviteChannel("imessage")}
            disabled={busy !== null}
            className="flex-1 rounded-lg border border-accent/50 bg-accent/15 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {busy === "imessage" ? "…" : "Send via Pact iMessage"}
          </button>
        </div>
      )}

      {inviteUrl && (
        <p className="mt-2 break-all text-[11px] text-muted">{inviteUrl}</p>
      )}
      {status && <p className="mt-2 text-xs text-success">{status}</p>}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
