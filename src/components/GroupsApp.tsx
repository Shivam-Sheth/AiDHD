"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { authFetch, getAccessToken, signOut } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  phone: string | null;
};

type TripGroup = {
  id: string;
  name: string;
  destination: string;
  status: string;
  booking_event_id: string | null;
  source_reel_url: string | null;
  trip_brief: Record<string, unknown>;
  updated_at: string;
};

type Message = {
  id: string;
  content: string;
  kind: string;
  user_id: string | null;
  created_at: string;
  profile?: Profile | null;
};

type SplitSummary = {
  balances: { user_id: string; name: string; net: number }[];
  settles: {
    from_user_id: string;
    from_name: string;
    to_user_id: string;
    to_name: string;
    amount: number;
  }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    paid_by: string;
    source: string;
  }[];
  currency: string;
};

type Tab = "chat" | "splits" | "friends" | "profile";

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

export function GroupsApp() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<Profile | null>(null);
  const [storage, setStorage] = useState<"supabase" | "memory">("memory");
  const [passportPresent, setPassportPresent] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<TripGroup[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [splits, setSplits] = useState<SplitSummary | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [chatInput, setChatInput] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [passport, setPassport] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = useMemo(
    () => groups.find((g) => g.id === activeId) ?? null,
    [groups, activeId],
  );

  const bootstrap = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setError("Supabase Auth is not configured on this deployment.");
      setBooting(false);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const meData = await authFetch<{
        profile: Profile;
        passport: { present: boolean };
        storage: "supabase" | "memory";
      }>("/api/app/me");
      setMe(meData.profile);
      setProfileName(meData.profile.name || "");
      setProfilePhone(meData.profile.phone || "");
      setPassportPresent(Boolean(meData.passport?.present));
      setStorage(meData.storage);

      const [friendsData, groupsData] = await Promise.all([
        authFetch<{ friends: Profile[] }>("/api/app/friends"),
        authFetch<{ groups: TripGroup[] }>("/api/app/groups"),
      ]);
      setFriends(friendsData.friends);
      setGroups(groupsData.groups);
      if (groupsData.groups[0]) {
        setActiveId((prev) => prev ?? groupsData.groups[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      if (String(e).includes("Sign in required")) router.replace("/login");
    } finally {
      setBooting(false);
    }
  }, [router]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const refreshGroup = useCallback(async (groupId: string) => {
    const data = await authFetch<{
      group: TripGroup;
      messages: Message[];
    }>(`/api/app/groups/${groupId}`);
    setMessages(data.messages);
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? data.group : g)),
    );
    try {
      const splitData = await authFetch<SplitSummary>(
        `/api/app/groups/${groupId}/splits`,
      );
      setSplits(splitData);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void refreshGroup(activeId).catch(() => undefined);
    const t = setInterval(() => {
      void authFetch<{ messages: Message[] }>(
        `/api/app/groups/${activeId}/messages`,
      )
        .then((d) => setMessages(d.messages))
        .catch(() => undefined);
    }, 3500);
    return () => clearInterval(t);
  }, [activeId, refreshGroup]);

  async function addFriend() {
    if (!friendQuery.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await authFetch<{ friends: Profile[]; friend: Profile }>(
        "/api/app/friends",
        {
          method: "POST",
          body: JSON.stringify({ query: friendQuery.trim() }),
        },
      );
      setFriends(data.friends);
      setFriendQuery("");
      setNotice(`Added ${data.friend.name || data.friend.email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add friend");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (!groupName.trim()) {
      setError("Give the group a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await authFetch<{ group: TripGroup }>(
        "/api/app/groups",
        {
          method: "POST",
          body: JSON.stringify({
            name: groupName.trim(),
            destination: destination.trim() || "TBD",
            friend_ids: selectedFriends,
          }),
        },
      );
      setGroupName("");
      setDestination("");
      setSelectedFriends([]);
      const groupsData = await authFetch<{ groups: TripGroup[] }>(
        "/api/app/groups",
      );
      setGroups(groupsData.groups);
      setActiveId(data.group.id);
      setTab("chat");
      setNotice("Group created — @AiDHD is in the chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setBusy(false);
    }
  }

  async function inviteSelected() {
    if (!activeId || !selectedFriends.length) return;
    setBusy(true);
    try {
      await authFetch(`/api/app/groups/${activeId}/members`, {
        method: "POST",
        body: JSON.stringify({ friend_ids: selectedFriends }),
      });
      setSelectedFriends([]);
      await refreshGroup(activeId);
      setNotice("Friends added to the group");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(invokeAgent = false) {
    if (!activeId || !chatInput.trim()) return;
    const content = chatInput;
    setChatInput("");
    setBusy(true);
    try {
      const data = await authFetch<{
        messages: Message[];
        group: TripGroup;
        agent: { engaged: boolean } | null;
      }>(`/api/app/groups/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          invoke_agent: invokeAgent,
        }),
      });
      setMessages(data.messages);
      setGroups((prev) =>
        prev.map((g) => (g.id === activeId ? data.group : g)),
      );
      if (data.agent?.engaged) setNotice("AiDHD replied in the chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setChatInput(content);
    } finally {
      setBusy(false);
    }
  }

  async function askAgent() {
    if (!activeId) return;
    setBusy(true);
    try {
      const data = await authFetch<{ messages: Message[]; group: TripGroup }>(
        `/api/app/groups/${activeId}/agent`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt:
              chatInput.trim() ||
              "@AiDHD read the chat and help us plan or book this trip.",
          }),
        },
      );
      setChatInput("");
      setMessages(data.messages);
      setGroups((prev) =>
        prev.map((g) => (g.id === activeId ? data.group : g)),
      );
      setNotice("AiDHD is on it");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  async function addExpense() {
    if (!activeId) return;
    const amount = Number(expenseAmount);
    if (!(amount > 0)) {
      setError("Enter a positive amount");
      return;
    }
    setBusy(true);
    try {
      const data = await authFetch<SplitSummary>(
        `/api/app/groups/${activeId}/splits`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "add_expense",
            description: expenseDesc || "Shared cost",
            amount,
          }),
        },
      );
      setSplits(data);
      setExpenseDesc("");
      setExpenseAmount("");
      await refreshGroup(activeId);
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
      const data = await authFetch<SplitSummary>(
        `/api/app/groups/${activeId}/splits`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "settle",
            from_user_id: from,
            to_user_id: to,
            amount,
          }),
        },
      );
      setSplits(data);
      setNotice("Settlement recorded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    try {
      const data = await authFetch<{ profile: Profile }>("/api/app/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
        }),
      });
      setMe(data.profile);
      setNotice("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePassport() {
    if (!passport.trim()) return;
    setBusy(true);
    try {
      await authFetch("/api/vault/passport", {
        method: "POST",
        body: JSON.stringify({
          passport_number: passport.trim(),
          display_name: profileName,
        }),
      });
      setPassport("");
      setPassportPresent(true);
      setNotice("Passport stored encrypted — AiDHD only sees that it’s on file");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passport save failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (booting) {
    return (
      <SiteShell showJoin={false} compact>
        <main className="flex min-h-screen items-center justify-center font-mono text-sm tracking-[0.14em] text-[var(--inkmute)] uppercase">
          Loading your groups…
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell
      compact
      showJoin={false}
      links={[
        { href: "/agent", label: "Agent" },
        { href: "/reel", label: "Reel" },
      ]}
      trailing={
        <>
          <span className="hidden font-mono text-[10px] tracking-[0.14em] text-[var(--inkmute)] uppercase sm:inline">
            {me?.name || me?.email}
          </span>
          <button
            type="button"
            className="btn-join !border-[var(--edge)] !text-[var(--inksoft)] hover:!border-[var(--coral)] hover:!text-[var(--coral)]"
            onClick={() => {
              void signOut().then(() => router.push("/login"));
            }}
          >
            sign out
          </button>
        </>
      }
    >
      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 pt-24 lg:grid-cols-[260px_1fr] sm:px-6">
        <aside className="space-y-5">
          <section className="border border-[var(--edge)] bg-[var(--panel)] p-4">
            <h2 className="font-display text-sm font-semibold">Your groups</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {groups.length === 0 && (
                <p className="text-xs text-[var(--inkmute)]">
                  Create a group and invite friends.
                </p>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActiveId(g.id);
                    setTab("chat");
                  }}
                  className={`px-3 py-2 text-left text-sm transition ${
                    activeId === g.id
                      ? "bg-[var(--ink)] text-[var(--void)]"
                      : "hover:bg-[var(--void)]"
                  }`}
                >
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs opacity-70">
                    {g.destination} · {g.status}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-[var(--edge)] pt-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full border border-[var(--edge)] bg-[var(--void)] px-2 py-1.5 text-sm outline-none"
              />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination (optional)"
                className="w-full border border-[var(--edge)] bg-[var(--void)] px-2 py-1.5 text-sm outline-none"
              />
              <p className="text-xs text-[var(--inkmute)]">
                Select friends in the Friends tab, then create.
              </p>
              <button
                type="button"
                disabled={busy}
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

          <div className="flex flex-wrap gap-2 border-b border-[var(--edge)] pb-3">
            {(
              [
                ["chat", "Chat + AiDHD"],
                ["splits", "Splits"],
                ["friends", "Friends"],
                ["profile", "Profile & passport"],
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
              <h1 className="font-display text-2xl font-semibold">Friends</h1>
              <p className="mt-1 text-sm text-[var(--inksoft)]">
                Add people who already have an AiDHD account — search by email,
                @handle, or name.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  value={friendQuery}
                  onChange={(e) => setFriendQuery(e.target.value)}
                  placeholder="friend@email.com or @handle"
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
                      {f.name || f.email}{" "}
                      <span className="text-[var(--inkmute)]">
                        {f.handle ? `@${f.handle}` : f.email}
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
              </ul>
              {active && selectedFriends.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary mt-4 text-sm"
                  onClick={() => void inviteSelected()}
                >
                  Add selected to “{active.name}”
                </button>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className="space-y-4 border border-[var(--edge)] bg-[var(--panel)] p-5">
              <div>
                <h1 className="font-display text-2xl font-semibold">
                  Traveler profile
                </h1>
                <p className="mt-1 text-sm text-[var(--inksoft)]">
                  Stored in Supabase. Passport is AES-GCM encrypted — the group
                  agent never sees the number, only whether it&apos;s on file.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-[var(--inksoft)]">Name</span>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="mt-1 w-full border border-[var(--edge)] bg-[var(--void)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--inksoft)]">Phone</span>
                  <input
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="mt-1 w-full border border-[var(--edge)] bg-[var(--void)] px-3 py-2 outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveProfile()}
                className="btn-primary text-sm"
              >
                Save profile
              </button>

              <div className="border-t border-[var(--edge)] pt-4">
                <h2 className="text-sm font-semibold">Passport vault</h2>
                <p className="mt-1 text-xs text-[var(--inkmute)]">
                  Status: {passportPresent ? "on file (encrypted)" : "not saved"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={passport}
                    onChange={(e) => setPassport(e.target.value)}
                    placeholder="Passport number"
                    className="min-w-[200px] flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !passport.trim()}
                    onClick={() => void savePassport()}
                    className="btn-primary text-sm"
                  >
                    Encrypt & save
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "chat" && !active && (
            <div className="border border-[var(--edge)] bg-[var(--panel)] p-8 text-center text-sm text-[var(--inksoft)]">
              Create or select a group. AiDHD sits in the chat like Meta AI —
              mention @AiDHD, paste a reel, or ask it to plan/book.
            </div>
          )}

          {tab === "chat" && active && (
            <div className="flex min-h-[520px] flex-col border border-[var(--edge)] bg-[var(--panel)]">
              <div className="border-b border-[var(--edge)] px-4 py-3">
                <h1 className="font-display text-xl font-semibold">
                  {active.name}
                </h1>
                <p className="text-xs text-[var(--inkmute)]">
                  {active.destination} · {active.status}
                  {active.booking_event_id
                    ? ` · booking ${active.booking_event_id}`
                    : ""}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m) => {
                  const mine = m.user_id === me?.id;
                  const agent = m.kind === "agent";
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[85%] ${mine ? "ml-auto text-right" : ""}`}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-[var(--inkmute)]">
                        {agent
                          ? "AiDHD"
                          : m.kind === "system"
                            ? "System"
                            : m.profile?.name || "Member"}
                        {m.kind !== "text" && !agent ? ` · ${m.kind}` : ""}
                      </div>
                      <div
                        className={`mt-0.5 whitespace-pre-wrap px-3 py-2 text-sm ${
                          agent
                            ? "border border-[var(--edgehot)] bg-[var(--void)]"
                            : m.kind === "system"
                              ? "border border-dashed border-[var(--edge)] text-[var(--inksoft)]"
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
              <div className="space-y-2 border-t border-[var(--edge)] p-3">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message the group — @AiDHD, paste a reel, ask to book…"
                    className="min-w-0 flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || !chatInput.trim()}
                    onClick={() => void sendChat(false)}
                    className="btn-primary text-sm"
                  >
                    Send
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void askAgent()}
                  className="btn-ghost w-full text-sm"
                >
                  Ask AiDHD (reads full group chat)
                </button>
              </div>
            </div>
          )}

          {tab === "splits" && active && (
            <div className="space-y-4 border border-[var(--edge)] bg-[var(--panel)] p-5">
              <h1 className="font-display text-2xl font-semibold">
                Trip splits
              </h1>
              <div className="grid gap-3 sm:grid-cols-3">
                {(splits?.balances ?? []).map((b) => (
                  <div
                    key={b.user_id}
                    className="border border-[var(--edge)] px-3 py-3"
                  >
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="mt-1 font-display text-xl">
                      {Math.abs(b.net) < 0.01
                        ? "settled"
                        : money(b.net, splits?.currency)}
                    </div>
                  </div>
                ))}
              </div>
              {(splits?.settles?.length ?? 0) > 0 && (
                <ul className="space-y-2">
                  {splits!.settles.map((s, i) => (
                    <li
                      key={`${s.from_user_id}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 border border-[var(--edge)] px-3 py-2 text-sm"
                    >
                      <span>
                        {s.from_name} → {s.to_name}:{" "}
                        {money(s.amount, splits?.currency)}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        disabled={busy}
                        onClick={() =>
                          void settle(s.from_user_id, s.to_user_id, s.amount)
                        }
                      >
                        Mark paid
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 border-t border-[var(--edge)] pt-4">
                <input
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Expense"
                  className="min-w-[160px] flex-1 border border-[var(--edge)] bg-[var(--void)] px-3 py-2 text-sm outline-none"
                />
                <input
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Amount"
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
          )}

          {tab === "splits" && !active && (
            <div className="border border-[var(--edge)] p-8 text-center text-sm text-[var(--inkmute)]">
              Select a group to manage splits.
            </div>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
