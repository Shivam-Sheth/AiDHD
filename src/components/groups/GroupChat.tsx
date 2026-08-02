"use client";

import { useEffect, useRef, useState } from "react";
import { InviteFriendsPanel } from "@/components/groups/InviteFriendsPanel";
import { groupAuthHeaders } from "@/lib/groups/client-session";
import type { GroupMember, GroupMessage, GroupParty } from "@/lib/groups/types";

type Props = {
  groupId: string;
  initialGroup: GroupParty;
  initialMembers: GroupMember[];
};

export function GroupChat({ groupId, initialGroup, initialMembers }: Props) {
  const [group, setGroup] = useState(initialGroup);
  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refreshMessages() {
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/messages`, { headers });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: GroupMessage[] };
    setMessages(data.messages || []);
  }

  useEffect(() => {
    void refreshMessages();
    const t = setInterval(() => void refreshMessages(), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    try {
      const headers = await groupAuthHeaders();
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed");
        setDraft(text);
        return;
      }
      setMessages(data.messages || []);
    } catch {
      setError("Network error");
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function refreshMembers() {
    const headers = await groupAuthHeaders();
    const detail = await fetch(`/api/groups/${groupId}`, { headers });
    if (detail.ok) {
      const d = await detail.json();
      setMembers(d.members || members);
      if (d.group) setGroup(d.group);
    }
  }

  async function volunteerSpoc() {
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/spoc`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok && data.group) {
      setGroup(data.group);
      await refreshMessages();
      await refreshMembers();
    }
  }

  const humans = members.filter((m) => m.role !== "bot");

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {group.mode} · encrypted chat
          </p>
          <h1 className="font-display text-2xl font-bold text-ink">
            {group.title}
          </h1>
          <p className="text-sm text-muted">
            {group.place}
            {group.proposed_dates.length
              ? ` · ${group.proposed_dates.join(" → ")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <InviteFriendsPanel
            groupId={groupId}
            groupTitle={group.title}
            onInvited={() => {
              void refreshMessages();
              void refreshMembers();
            }}
          />
          <button
            type="button"
            onClick={() => void volunteerSpoc()}
            className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            I&apos;ll be SPOC
          </button>
        </div>
      </header>

      <div className="mb-3 flex shrink-0 flex-wrap gap-2">
        {humans.map((m) => (
          <span
            key={m.user_id}
            className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-700"
          >
            {m.display_name}
            {m.role === "organizer"
              ? " · host"
              : m.role === "spoc"
                ? " · SPOC"
                : ""}
          </span>
        ))}
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
          AiDHD · bot
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface/60 p-3">
        {messages.map((m) => {
          const isBot = m.sender_id === "bot_aidhd" || m.kind === "agent";
          return (
            <div
              key={m.id}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                isBot
                  ? "bg-accent/15 text-ink"
                  : "ml-auto bg-subtle text-ink-800"
              }`}
            >
              <p className="mb-0.5 text-[11px] font-medium text-muted">
                {m.sender_name}
                {isBot ? " · AI" : ""}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
        {[
          "@AiDHD weather?",
          "@AiDHD find dinner",
          "@AiDHD search flights",
          "@AiDHD book dinner",
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setDraft(chip)}
            className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-ink"
          >
            {chip}
          </button>
        ))}
      </div>

      <form onSubmit={send} className="mt-2 flex shrink-0 gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group… tag @AiDHD"
          className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-inverse disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
      {busy && (
        <p className="mt-1 text-center text-[11px] text-accent">
          AiDHD is thinking…
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-faint">
        Messages encrypted at rest. AiDHD is a participant (can read when
        tagged), same model as Meta AI in WhatsApp.
      </p>
    </div>
  );
}
