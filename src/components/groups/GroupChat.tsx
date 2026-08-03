"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InviteFriendsPanel } from "@/components/groups/InviteFriendsPanel";
import { groupAuthHeaders, readLocalGroupUser } from "@/lib/groups/client-session";
import type {
  GroupMember,
  GroupMessage,
  GroupParty,
  GroupPoll,
  MessageRead,
} from "@/lib/groups/types";

type Props = {
  groupId: string;
  initialGroup: GroupParty;
  initialMembers: GroupMember[];
};

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🔥"];

export function GroupChat({ groupId, initialGroup, initialMembers }: Props) {
  const [group, setGroup] = useState(initialGroup);
  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reads, setReads] = useState<MessageRead[]>([]);
  const [polls, setPolls] = useState<GroupPoll[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(
    new Set(),
  );
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const [live, setLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);
  const lastMarkedRead = useRef<string | null>(null);

  const myId = useMemo(() => readLocalGroupUser()?.id || "", []);

  const refreshMessages = useCallback(async () => {
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/messages`, { headers });
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: GroupMessage[];
      reads?: MessageRead[];
    };
    setMessages(data.messages || []);
    if (data.reads) setReads(data.reads);
  }, [groupId]);

  const refreshPolls = useCallback(async () => {
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/polls`, { headers });
    if (res.ok) {
      const data = await res.json();
      setPolls(data.polls || []);
    }
  }, [groupId]);

  const refreshApprovals = useCallback(async () => {
    const headers = await groupAuthHeaders();
    const res = await fetch(`/api/groups/${groupId}/approvals`, { headers });
    if (res.ok) {
      const data = (await res.json()) as { approvals?: { id: string }[] };
      setPendingApprovals(new Set((data.approvals || []).map((a) => a.id)));
    }
  }, [groupId]);

  const refreshAll = useCallback(() => {
    void refreshMessages();
    void refreshPolls();
    void refreshApprovals();
  }, [refreshMessages, refreshPolls, refreshApprovals]);

  // Supabase Realtime — live messages / reactions / polls / approvals /
  // typing. Falls back to polling (4s) when Realtime isn't available.
  useEffect(() => {
    refreshAll();
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase/client");
        if (!supabase || cancelled) return;
        const ch = supabase.channel(`group:${groupId}`);
        ch.on("broadcast", { event: "message" }, () => void refreshMessages());
        ch.on(
          "broadcast",
          { event: "message_updated" },
          () => void refreshMessages(),
        );
        ch.on("broadcast", { event: "reaction" }, () => void refreshMessages());
        ch.on("broadcast", { event: "poll" }, () => {
          void refreshPolls();
          void refreshMessages();
        });
        ch.on("broadcast", { event: "approval" }, () => {
          void refreshApprovals();
          void refreshMessages();
        });
        ch.on("broadcast", { event: "read" }, () => void refreshMessages());
        ch.on(
          "broadcast",
          { event: "member" },
          ({ payload }: { payload: Record<string, unknown> }) => {
            if (payload?.typing && payload.user_id !== myId) {
              const uid = String(payload.user_id);
              const name = String(payload.user_name || "Someone");
              setTypers((prev) => ({ ...prev, [uid]: { name, at: Date.now() } }));
            } else {
              void refreshAll();
            }
          },
        );
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED") setLive(true);
        });
        channel = ch;
      } catch {
        // no realtime — polling covers it
      }
    })();

    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Polling fallback — slow when realtime is live, 4s otherwise.
  useEffect(() => {
    const t = setInterval(() => void refreshMessages(), live ? 20000 : 4000);
    return () => clearInterval(t);
  }, [live, refreshMessages]);

  // Expire typing indicators.
  useEffect(() => {
    const t = setInterval(() => {
      setTypers((prev) => {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (Date.now() - v.at < 5000) next[k] = v;
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Read receipts: mark read when new messages arrive while viewing.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastMarkedRead.current) return;
    lastMarkedRead.current = last.id;
    void (async () => {
      const headers = await groupAuthHeaders();
      await fetch(`/api/groups/${groupId}/read`, {
        method: "POST",
        headers,
        body: JSON.stringify({ last_message_id: last.id }),
      }).catch(() => {});
    })();
  }, [messages, groupId]);

  async function sendTyping() {
    if (Date.now() - lastTypingSent.current < 3000) return;
    lastTypingSent.current = Date.now();
    const headers = await groupAuthHeaders();
    void fetch(`/api/groups/${groupId}/typing`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");

    try {
      const headers = await groupAuthHeaders();

      if (editing) {
        const res = await fetch(
          `/api/groups/${groupId}/messages/${editing.id}`,
          { method: "PATCH", headers, body: JSON.stringify({ text }) },
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Edit failed");
          setDraft(text);
        } else {
          setEditing(null);
          await refreshMessages();
        }
        return;
      }

      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          reply_to: replyTo?.id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed");
        setDraft(text);
        return;
      }
      setReplyTo(null);
      setMessages(data.messages || []);
      if (data.reads) setReads(data.reads);
      void refreshApprovals();
      void refreshPolls();
    } catch {
      setError("Network error");
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function toggleReaction(m: GroupMessage, emoji: string) {
    const mine = (m.reactions || []).some(
      (r) => r.user_id === myId && r.emoji === emoji,
    );
    const headers = await groupAuthHeaders();
    if (mine) {
      await fetch(
        `/api/groups/${groupId}/messages/${m.id}/reactions?emoji=${encodeURIComponent(emoji)}`,
        { method: "DELETE", headers },
      );
    } else {
      await fetch(`/api/groups/${groupId}/messages/${m.id}/reactions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ emoji }),
      });
    }
    void refreshMessages();
  }

  async function deleteMessage(m: GroupMessage) {
    const headers = await groupAuthHeaders();
    await fetch(`/api/groups/${groupId}/messages/${m.id}`, {
      method: "DELETE",
      headers,
    });
    void refreshMessages();
  }

  async function decideApproval(approvalId: string, decision: "approved" | "declined") {
    setPendingApprovals((prev) => {
      const next = new Set(prev);
      next.delete(approvalId);
      return next;
    });
    const headers = await groupAuthHeaders();
    await fetch(`/api/groups/${groupId}/approvals/${approvalId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision }),
    });
    refreshAll();
  }

  async function votePoll(pollId: string, optionIndex: number) {
    const headers = await groupAuthHeaders();
    await fetch(`/api/groups/${groupId}/polls/${pollId}/vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ option_index: optionIndex }),
    });
    void refreshPolls();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const headers = (await groupAuthHeaders()) as Record<string, string>;
      delete headers["Content-Type"]; // let the browser set the boundary
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/groups/${groupId}/files`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
      } else {
        await refreshMessages();
      }
    } finally {
      setUploading(false);
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
  const byId = useMemo(() => {
    const map = new Map<string, GroupMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);
  const pollsById = useMemo(() => {
    const map = new Map<string, GroupPoll>();
    for (const p of polls) map.set(p.id, p);
    return map;
  }, [polls]);

  const typingNames = Object.values(typers).map((t) => t.name);
  const lastMsg = messages[messages.length - 1];
  const seenBy = lastMsg
    ? reads
        .filter(
          (r) =>
            r.user_id !== myId &&
            r.user_id !== lastMsg.sender_id &&
            r.last_read_at >= lastMsg.created_at,
        )
        .map(
          (r) =>
            humans.find((h) => h.user_id === r.user_id)?.display_name || null,
        )
        .filter(Boolean)
    : [];

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {group.mode} · encrypted chat{live ? " · live" : ""}
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
              ? " · owner"
              : m.role === "admin"
                ? " · admin"
                : m.role === "spoc"
                  ? " · SPOC"
                  : ""}
          </span>
        ))}
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
          Prava · AI
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface/60 p-3">
        {messages.map((m) => {
          const isBot = m.sender_id === "bot_aidhd" || m.kind === "agent";
          const isMine = m.sender_id === myId;
          const quoted = m.reply_to ? byId.get(m.reply_to) : null;
          const approvalId =
            m.kind === "approval_request"
              ? String(m.meta?.approval_id || "")
              : "";
          const poll =
            m.kind === "poll" && m.meta?.poll_id
              ? pollsById.get(String(m.meta.poll_id))
              : null;
          const fileUrl =
            m.kind === "file" ? String(m.meta?.file_url || "") : "";

          const reactionGroups = new Map<string, { count: number; mine: boolean }>();
          for (const r of m.reactions || []) {
            const gRec = reactionGroups.get(r.emoji) || { count: 0, mine: false };
            gRec.count += 1;
            if (r.user_id === myId) gRec.mine = true;
            reactionGroups.set(r.emoji, gRec);
          }

          return (
            <div
              key={m.id}
              className={`group max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                isBot
                  ? "bg-accent/15 text-ink"
                  : isMine
                    ? "ml-auto bg-subtle text-ink-800"
                    : "bg-subtle/60 text-ink-800"
              }`}
            >
              <p className="mb-0.5 text-[11px] font-medium text-muted">
                {m.sender_name}
                {isBot ? " · AI" : ""}
                {m.edited_at && !m.deleted_at ? " · edited" : ""}
              </p>

              {quoted && !m.deleted_at && (
                <p className="mb-1 border-l-2 border-line pl-2 text-[11px] text-muted">
                  {quoted.sender_name}: {(quoted.body || "").slice(0, 90)}
                </p>
              )}

              {m.deleted_at ? (
                <p className="italic text-faint">message deleted</p>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              )}

              {fileUrl && !m.deleted_at && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-accent underline"
                >
                  Open file
                </a>
              )}

              {poll && (
                <div className="mt-2 space-y-1.5">
                  {poll.options.map((opt, i) => {
                    const votes = (poll.votes || []).filter(
                      (v) => v.option_index === i,
                    );
                    const mine = votes.some((v) => v.user_id === myId);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => void votePoll(poll.id, i)}
                        className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                          mine
                            ? "border-accent bg-accent/15 text-ink"
                            : "border-line text-ink-700 hover:border-accent/40"
                        }`}
                      >
                        <span>{opt}</span>
                        <span className="text-muted">
                          {votes.length > 0 ? votes.length : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {approvalId && pendingApprovals.has(approvalId) && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decideApproval(approvalId, "approved")}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-inverse"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideApproval(approvalId, "declined")}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-danger/40 hover:text-danger"
                  >
                    Decline
                  </button>
                </div>
              )}

              {reactionGroups.size > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[...reactionGroups.entries()].map(([emoji, info]) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => void toggleReaction(m, emoji)}
                      className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                        info.mine
                          ? "border-accent bg-accent/10"
                          : "border-line bg-canvas"
                      }`}
                    >
                      {emoji} {info.count}
                    </button>
                  ))}
                </div>
              )}

              {!m.deleted_at && m.kind !== "system" && (
                <div className="mt-1 hidden gap-1.5 text-[11px] text-faint group-hover:flex">
                  {QUICK_EMOJI.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => void toggleReaction(m, emoji)}
                      className="hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(m);
                      setEditing(null);
                    }}
                    className="hover:text-ink"
                  >
                    Reply
                  </button>
                  {isMine && m.kind === "text" && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(m);
                        setReplyTo(null);
                        setDraft(m.body || "");
                      }}
                      className="hover:text-ink"
                    >
                      Edit
                    </button>
                  )}
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => void deleteMessage(m)}
                      className="hover:text-danger"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {seenBy.length > 0 && (
          <p className="text-right text-[10px] text-faint">
            Seen by {seenBy.join(", ")}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="mt-1 text-[11px] text-muted">
          {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"}{" "}
          typing…
        </p>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {(replyTo || editing) && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-subtle/60 px-3 py-1.5 text-xs text-ink-700">
          <span className="truncate">
            {editing
              ? "Editing message"
              : `Replying to ${replyTo!.sender_name}: ${(replyTo!.body || "").slice(0, 60)}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setReplyTo(null);
              setEditing(null);
              if (editing) setDraft("");
            }}
            className="ml-2 shrink-0 text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
        {[
          "@Prava weather?",
          "@Prava find dinner",
          "@Prava search flights",
          "@Prava make a poll: Friday or Saturday",
          "@Prava summarize the chat",
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
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Share a file"
          className="rounded-xl border border-line px-3 py-2.5 text-sm text-muted hover:border-accent/40 hover:text-ink disabled:opacity-40"
        >
          {uploading ? "…" : "📎"}
        </button>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            void sendTyping();
          }}
          placeholder="Message the group… tag @Prava"
          className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-inverse disabled:opacity-40"
        >
          {busy ? "…" : editing ? "Save" : "Send"}
        </button>
      </form>
      {busy && (
        <p className="mt-1 text-center text-[11px] text-accent">
          Prava is thinking…
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-faint">
        Messages encrypted at rest. Prava is a participant (can read when
        tagged) and always asks approval before booking, paying, or calling.
      </p>
    </div>
  );
}
