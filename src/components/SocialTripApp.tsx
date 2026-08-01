"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeProvider";
import {
  getStoredUserId,
  setStoredUserId,
} from "@/lib/session-client";

type AppUser = {
  id: string;
  name: string;
  handle: string;
  email?: string;
  channel: string;
};

type EventRow = {
  id: string;
  type: string;
  title: string;
  destination_or_venue: string;
  proposed_dates: string[];
  organizer_id: string;
  invitee_ids: string[];
  status: string;
  selected_package_id?: string;
  created_at: string;
};

type GroupMessage = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  kind: string;
  meta?: Record<string, unknown>;
  created_at: string;
  user?: AppUser | null;
};

type SplitSummary = {
  event_id: string;
  currency: string;
  expenses: {
    id: string;
    description: string;
    amount: number;
    paid_by: string;
    source: string;
    splits: { user_id: string; amount: number }[];
  }[];
  settlements: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    amount: number;
  }[];
  balances: { user_id: string; name: string; net: number }[];
  settles: {
    from_user_id: string;
    from_name: string;
    to_user_id: string;
    to_name: string;
    amount: number;
  }[];
  member_ids: string[];
  members?: (AppUser | undefined | null)[];
};

type Tab = "chat" | "splits" | "friends" | "reel";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function SocialTripApp() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [friends, setFriends] = useState<AppUser[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [splits, setSplits] = useState<SplitSummary | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [reelUrl, setReelUrl] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  );

  const nameOf = useCallback(
    (id: string) =>
      users.find((u) => u.id === id)?.name ||
      friends.find((u) => u.id === id)?.name ||
      id,
    [users, friends],
  );

  const loadUsers = useCallback(async () => {
    const data = await j<{ users: AppUser[] }>("/api/users");
    setUsers(data.users);
    return data.users;
  }, []);

  const loadFriends = useCallback(async (userId: string) => {
    const data = await j<{ friends: AppUser[] }>(
      `/api/friends?user_id=${encodeURIComponent(userId)}`,
    );
    setFriends(data.friends);
  }, []);

  const loadEvents = useCallback(async (userId: string) => {
    const data = await j<{ events: EventRow[] }>(
      `/api/events?user_id=${encodeURIComponent(userId)}`,
    );
    setEvents(data.events);
    return data.events;
  }, []);

  const loadMessages = useCallback(async (eventId: string) => {
    const data = await j<{ messages: GroupMessage[] }>(
      `/api/events/${eventId}/messages`,
    );
    setMessages(data.messages);
  }, []);

  const loadSplits = useCallback(async (eventId: string) => {
    const data = await j<SplitSummary>(`/api/events/${eventId}/splits`);
    setSplits(data);
  }, []);

  const bootstrap = useCallback(async () => {
    setError(null);
    const all = await loadUsers();
    const stored = getStoredUserId();
    const current =
      all.find((u) => u.id === stored) ||
      all.find((u) => u.id === "user_maya") ||
      all[0] ||
      null;
    if (!current) return;
    setMe(current);
    setStoredUserId(current.id);
    await loadFriends(current.id);
    const evs = await loadEvents(current.id);
    if (evs[0]) {
      setActiveId((prev) => prev ?? evs[0]!.id);
    }
  }, [loadUsers, loadFriends, loadEvents]);

  useEffect(() => {
    void bootstrap().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [bootstrap]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId).catch(() => undefined);
    void loadSplits(activeId).catch(() => undefined);
    const t = setInterval(() => {
      void loadMessages(activeId).catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [activeId, loadMessages, loadSplits]);

  async function becomeUser(user: AppUser) {
    setMe(user);
    setStoredUserId(user.id);
    setSelectedFriends([]);
    setError(null);
    await loadFriends(user.id);
    const evs = await loadEvents(user.id);
    setActiveId(evs[0]?.id ?? null);
  }

  async function createAccount() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await j<{ user: AppUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await loadUsers();
      await becomeUser(data.user);
      setNotice(`Signed in as ${data.user.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  async function addFriend() {
    if (!me || !friendQuery.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await j<{ friends: AppUser[]; friend: AppUser }>(
        "/api/friends",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: me.id,
            query: friendQuery.trim(),
            create_if_missing: true,
          }),
        },
      );
      setFriends(data.friends);
      setFriendQuery("");
      await loadUsers();
      setNotice(`Added ${data.friend.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add friend");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      const data = await j<{ event: EventRow }>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          type: "trip",
          title: groupTitle.trim() || "Group trip",
          organizer_id: me.id,
          friend_ids: selectedFriends,
          invitee_ids: [me.id, ...selectedFriends],
        }),
      });
      setGroupTitle("");
      setSelectedFriends([]);
      const evs = await loadEvents(me.id);
      setEvents(evs);
      setActiveId(data.event.id);
      setTab("chat");
      setNotice("Group created");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!me || !activeId || !chatInput.trim()) return;
    const content = chatInput;
    setChatInput("");
    setBusy(true);
    try {
      const data = await j<{ messages: GroupMessage[] }>(
        `/api/events/${activeId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: me.id, content }),
        },
      );
      setMessages(data.messages);
      if (data.messages.at(-1)?.kind === "reel") {
        setNotice("Reel link saved in chat — open the Reel tab to turn it into a plan.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setChatInput(content);
    } finally {
      setBusy(false);
    }
  }

  async function addExpense() {
    if (!me || !activeId) return;
    const amount = Number(expenseAmount);
    if (!(amount > 0)) {
      setError("Enter a positive amount");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await j<SplitSummary>(`/api/events/${activeId}/splits`, {
        method: "POST",
        body: JSON.stringify({
          action: "add_expense",
          description: expenseDesc || "Shared cost",
          amount,
          paid_by: me.id,
        }),
      });
      setSplits(data);
      setExpenseDesc("");
      setExpenseAmount("");
      await loadMessages(activeId);
      setNotice("Expense added and split across the group");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Expense failed");
    } finally {
      setBusy(false);
    }
  }

  async function settle(from: string, to: string, amount: number) {
    if (!activeId) return;
    setBusy(true);
    try {
      const data = await j<SplitSummary>(`/api/events/${activeId}/splits`, {
        method: "POST",
        body: JSON.stringify({
          action: "settle",
          from_user_id: from,
          to_user_id: to,
          amount,
        }),
      });
      setSplits(data);
      await loadMessages(activeId);
      setNotice("Settlement recorded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncSplits() {
    if (!activeId) return;
    setBusy(true);
    try {
      const data = await j<SplitSummary>(`/api/events/${activeId}/splits`, {
        method: "POST",
        body: JSON.stringify({ action: "sync" }),
      });
      setSplits(data);
      setNotice("Synced costs from bookings / selected package");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function reelToGroup() {
    if (!me || !reelUrl.trim()) return;
    setBusy(true);
    setError(null);
    setNotice("Planning from reel…");
    try {
      const data = await j<{ event: EventRow; plan: unknown }>(
        "/api/reel/to-event",
        {
          method: "POST",
          body: JSON.stringify({
            url: reelUrl.trim(),
            organizer_id: me.id,
            friend_ids: selectedFriends.length
              ? selectedFriends
              : active
                ? active.invitee_ids.filter((id) => id !== me.id)
                : friends.map((f) => f.id),
            invitee_ids: active
              ? active.invitee_ids
              : undefined,
            plan: true,
          }),
        },
      );
      setReelUrl("");
      const evs = await loadEvents(me.id);
      setEvents(evs);
      setActiveId(data.event.id);
      setTab("chat");
      setNotice(
        data.plan
          ? "Reel decoded into a group trip"
          : "Group created with the reel (planner unavailable — chat still has the link)",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reel import failed");
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function inviteSelectedToActive() {
    if (!me || !activeId || selectedFriends.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const data = await j<{ event: EventRow; added: string[] }>(
        `/api/events/${activeId}/members`,
        {
          method: "POST",
          body: JSON.stringify({
            user_id: me.id,
            friend_ids: selectedFriends,
          }),
        },
      );
      setSelectedFriends([]);
      const evs = await loadEvents(me.id);
      setEvents(evs);
      await loadMessages(activeId);
      await loadSplits(activeId);
      setNotice(
        data.added.length
          ? `Added ${data.added.length} friend(s) to the group`
          : "Those friends were already in the group",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <div
        className="pointer-events-none absolute inset-0 -z-10 site-atmosphere"
        aria-hidden
      />

      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pt-6 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight"
          >
            AiDHD
          </Link>
          <span className="text-sm text-[var(--inkmute)]">Groups</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Link href="/reel" className="btn-ghost text-sm">
            Reel planner
          </Link>
          <Link href="/agent" className="btn-ghost text-sm">
            Concierge
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[240px_1fr] sm:px-6">
        <aside className="space-y-5">
          <section className="border border-[var(--edge)] bg-[var(--panel)] p-4">
            <h2 className="font-display text-sm font-semibold">You</h2>
            <p className="mt-1 text-xs text-[var(--inkmute)]">
              Pick a demo person or create yourself.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void becomeUser(u)}
                  className={`px-3 py-2 text-left text-sm transition ${
                    me?.id === u.id
                      ? "bg-[var(--ink)] text-[var(--void)]"
                      : "hover:bg-[var(--void)]"
                  }`}
                >
                  {u.name}
                  <span className="ml-1 text-xs opacity-70">@{u.handle}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--void)] px-2 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void createAccount()}
                className="btn-ghost text-xs"
              >
                Join
              </button>
            </div>
          </section>

          <section className="border border-[var(--edge)] bg-[var(--panel)] p-4">
            <h2 className="font-display text-sm font-semibold">Groups</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {events.length === 0 && (
                <p className="text-xs text-[var(--inkmute)]">No groups yet.</p>
              )}
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setActiveId(e.id);
                    setTab("chat");
                  }}
                  className={`px-3 py-2 text-left text-sm transition ${
                    activeId === e.id
                      ? "bg-[var(--ink)] text-[var(--void)]"
                      : "hover:bg-[var(--void)]"
                  }`}
                >
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs opacity-70">
                    {e.destination_or_venue} · {e.status}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-[var(--edge)] pt-3">
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="New group title"
                className="w-full border border-[var(--edge)] bg-[var(--void)] px-2 py-1.5 text-sm outline-none"
              />
              <p className="text-xs text-[var(--inkmute)]">
                Add friends below, then create.
              </p>
              <button
                type="button"
                disabled={busy || !me}
                onClick={() => void createGroup()}
                className="btn-primary w-full text-sm"
              >
                Create group
              </button>
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          {(error || notice) && (
            <div
              className={`border px-4 py-3 text-sm ${
                error
                  ? "border-red-500/40 text-red-600 dark:text-red-300"
                  : "border-[var(--edge)] text-[var(--inksoft)]"
              }`}
            >
              {error || notice}
            </div>
          )}

          {!me && (
            <div className="border border-[var(--edge)] bg-[var(--panel)] p-8 text-center">
              <h1 className="font-display text-3xl font-semibold">
                Group trips that actually settle up
              </h1>
              <p className="mt-3 text-[var(--inksoft)]">
                Friends, group chat, Instagram reels → plans, and Splitwise-style
                splits from bookings.
              </p>
            </div>
          )}

          {me && (
            <>
              <div className="flex flex-wrap gap-2 border-b border-[var(--edge)] pb-3">
                {(
                  [
                    ["chat", "Chat"],
                    ["splits", "Splits"],
                    ["friends", "Friends"],
                    ["reel", "Instagram reel"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`px-3 py-1.5 text-sm ${
                      tab === id
                        ? "bg-[var(--ink)] text-[var(--void)]"
                        : "btn-ghost"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "friends" && (
                <div className="border border-[var(--edge)] bg-[var(--panel)] p-5">
                  <h1 className="font-display text-2xl font-semibold">
                    Friends
                  </h1>
                  <p className="mt-1 text-sm text-[var(--inksoft)]">
                    Add people by name or @handle. New names are created and
                    friended.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={friendQuery}
                      onChange={(e) => setFriendQuery(e.target.value)}
                      placeholder="@jordan or Alex"
                      className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void addFriend();
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void addFriend()}
                      className="btn-primary text-sm"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="mt-5 space-y-2">
                    {friends.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between border border-[var(--edge)] px-3 py-2 text-sm"
                      >
                        <span>
                          {f.name}{" "}
                          <span className="text-[var(--inkmute)]">
                            @{f.handle}
                          </span>
                        </span>
                        <label className="flex items-center gap-2 text-xs text-[var(--inkmute)]">
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(f.id)}
                            onChange={() => toggleFriend(f.id)}
                          />
                          Select
                        </label>
                      </li>
                    ))}
                    {friends.length === 0 && (
                      <li className="text-sm text-[var(--inkmute)]">
                        No friends yet — add Maya, Jordan, Sam, or anyone.
                      </li>
                    )}
                  </ul>
                  {active && selectedFriends.length > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      className="btn-primary mt-4 text-sm"
                      onClick={() => void inviteSelectedToActive()}
                    >
                      Add selected to “{active.title}”
                    </button>
                  )}
                </div>
              )}

              {tab === "reel" && (
                <div className="border border-[var(--edge)] bg-[var(--panel)] p-5">
                  <h1 className="font-display text-2xl font-semibold">
                    Instagram reel → group trip
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-[var(--inksoft)]">
                    Paste a public Instagram (or TikTok) reel. We decode it,
                    create a group with your selected friends, and drop the reel
                    into chat.
                  </p>
                  <textarea
                    value={reelUrl}
                    onChange={(e) => setReelUrl(e.target.value)}
                    rows={3}
                    placeholder="https://www.instagram.com/reel/…"
                    className="mt-4 w-full border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {friends.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFriend(f.id)}
                        className={`px-3 py-1 text-xs ${
                          selectedFriends.includes(f.id)
                            ? "bg-[var(--ink)] text-[var(--void)]"
                            : "border border-[var(--edge)]"
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy || !reelUrl.trim()}
                    onClick={() => void reelToGroup()}
                    className="btn-primary mt-4 text-sm"
                  >
                    {busy ? "Working…" : "Create trip from reel"}
                  </button>
                  <p className="mt-3 text-xs text-[var(--inkmute)]">
                    Or paste a reel URL directly in group chat — it is tagged as
                    a reel message.
                  </p>
                </div>
              )}

              {(tab === "chat" || tab === "splits") && !active && (
                <div className="border border-[var(--edge)] bg-[var(--panel)] p-8 text-center text-sm text-[var(--inksoft)]">
                  Select or create a group to chat and split costs.
                </div>
              )}

              {tab === "chat" && active && (
                <div className="flex min-h-[480px] flex-col border border-[var(--edge)] bg-[var(--panel)]">
                  <div className="border-b border-[var(--edge)] px-4 py-3">
                    <h1 className="font-display text-xl font-semibold">
                      {active.title}
                    </h1>
                    <p className="text-xs text-[var(--inkmute)]">
                      {active.invitee_ids.map(nameOf).join(", ")} ·{" "}
                      {active.destination_or_venue}
                    </p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {messages.map((m) => {
                      const mine = m.user_id === me.id;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[85%] ${mine ? "ml-auto text-right" : ""}`}
                        >
                          <div className="text-[10px] uppercase tracking-wide text-[var(--inkmute)]">
                            {m.user?.name || nameOf(m.user_id)}
                            {m.kind !== "text" ? ` · ${m.kind}` : ""}
                          </div>
                          <div
                            className={`mt-0.5 whitespace-pre-wrap px-3 py-2 text-sm ${
                              m.kind === "system"
                                ? "border border-dashed border-[var(--edge)] text-[var(--inksoft)]"
                                : m.kind === "reel"
                                  ? "border border-[var(--edgehot)] bg-[var(--void)]"
                                  : m.kind === "expense"
                                    ? "border border-[var(--edge)] text-[var(--inksoft)]"
                                    : mine
                                      ? "bg-[var(--ink)] text-[var(--void)]"
                                      : "bg-[var(--void)]"
                            }`}
                          >
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 border-t border-[var(--edge)] p-3">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Message the group — or paste an Instagram reel"
                      className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendChat();
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={busy || !chatInput.trim()}
                      onClick={() => void sendChat()}
                      className="btn-primary text-sm"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              {tab === "splits" && active && (
                <div className="space-y-4 border border-[var(--edge)] bg-[var(--panel)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl font-semibold">
                        Trip splits
                      </h1>
                      <p className="mt-1 text-sm text-[var(--inksoft)]">
                        Splitwise-style balances from package components and
                        confirmed bookings. Organizer is the default payer until
                        you settle up.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void syncSplits()}
                      className="btn-ghost text-sm"
                    >
                      Sync from bookings
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {(splits?.balances ?? []).map((b) => (
                      <div
                        key={b.user_id}
                        className="border border-[var(--edge)] px-3 py-3"
                      >
                        <div className="text-sm font-medium">{b.name}</div>
                        <div
                          className={`mt-1 font-display text-xl ${
                            b.net > 0.009
                              ? "text-emerald-600 dark:text-emerald-400"
                              : b.net < -0.009
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-[var(--inkmute)]"
                          }`}
                        >
                          {b.net > 0.009
                            ? `+${money(b.net, splits?.currency)}`
                            : b.net < -0.009
                              ? money(b.net, splits?.currency)
                              : "settled"}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--inkmute)]">
                          {b.net > 0.009
                            ? "is owed"
                            : b.net < -0.009
                              ? "owes"
                              : "even"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(splits?.settles?.length ?? 0) > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold">Settle up</h2>
                      <ul className="mt-2 space-y-2">
                        {splits!.settles.map((s, i) => (
                          <li
                            key={`${s.from_user_id}-${s.to_user_id}-${i}`}
                            className="flex flex-wrap items-center justify-between gap-2 border border-[var(--edge)] px-3 py-2 text-sm"
                          >
                            <span>
                              {s.from_name} → {s.to_name}:{" "}
                              {money(s.amount, splits?.currency)}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void settle(
                                  s.from_user_id,
                                  s.to_user_id,
                                  s.amount,
                                )
                              }
                              className="btn-ghost text-xs"
                            >
                              Mark paid
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h2 className="text-sm font-semibold">Expenses</h2>
                    <ul className="mt-2 space-y-2">
                      {(splits?.expenses ?? []).length === 0 && (
                        <li className="text-sm text-[var(--inkmute)]">
                          No expenses yet. Vote a package / book the trip, or add
                          one manually.
                        </li>
                      )}
                      {(splits?.expenses ?? []).map((e) => (
                        <li
                          key={e.id}
                          className="border border-[var(--edge)] px-3 py-2 text-sm"
                        >
                          <div className="flex justify-between gap-2">
                            <span>{e.description}</span>
                            <span className="font-medium">
                              {money(e.amount, splits?.currency)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--inkmute)]">
                            Paid by {nameOf(e.paid_by)} · {e.source} · split{" "}
                            {e.splits
                              .map(
                                (s) =>
                                  `${nameOf(s.user_id)} ${money(s.amount, splits?.currency)}`,
                              )
                              .join(", ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-[var(--edge)] pt-4">
                    <h2 className="text-sm font-semibold">Add expense</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        value={expenseDesc}
                        onChange={(e) => setExpenseDesc(e.target.value)}
                        placeholder="Dinner, Uber, tickets…"
                        className="min-w-[160px] flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                      />
                      <input
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="Amount"
                        inputMode="decimal"
                        className="w-28 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void addExpense()}
                        className="btn-primary text-sm"
                      >
                        Split equally
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
