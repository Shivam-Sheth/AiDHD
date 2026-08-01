import { randomUUID } from "crypto";
import { DEMO_USERS } from "./demo-users";
import type {
  AppUser,
  Expense,
  Friendship,
  GroupMessage,
  Settlement,
} from "./social-types";
import type { Channel } from "./types";

interface SocialStoreShape {
  users: Map<string, AppUser>;
  friendships: Map<string, Friendship>;
  messages: Map<string, GroupMessage>;
  expenses: Map<string, Expense>;
  settlements: Map<string, Settlement>;
  seeded: boolean;
}

const globalForSocial = globalThis as unknown as {
  __aidhdSocialStore?: SocialStoreShape;
};

function createSocialStore(): SocialStoreShape {
  return {
    users: new Map(),
    friendships: new Map(),
    messages: new Map(),
    expenses: new Map(),
    settlements: new Map(),
    seeded: false,
  };
}

export function getSocialStore(): SocialStoreShape {
  if (!globalForSocial.__aidhdSocialStore) {
    globalForSocial.__aidhdSocialStore = createSocialStore();
  }
  return globalForSocial.__aidhdSocialStore;
}

function slugHandle(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || `user${Math.random().toString(36).slice(2, 6)}`;
}

export function ensureSocialSeeded() {
  const store = getSocialStore();
  if (store.seeded && store.users.size > 0) return;

  for (const u of DEMO_USERS) {
    store.users.set(u.id, {
      id: u.id,
      name: u.name,
      handle: slugHandle(u.name),
      channel: u.channel,
      email: `${slugHandle(u.name)}@aidhd.demo`,
      created_at: new Date().toISOString(),
    });
  }

  // Everyone is friends with everyone in the demo trio
  const ids = DEMO_USERS.map((u) => u.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!;
      const b = ids[j]!;
      const id = `friend_${a}_${b}`;
      store.friendships.set(id, {
        id,
        user_id: a,
        friend_id: b,
        status: "accepted",
        created_at: new Date().toISOString(),
      });
    }
  }

  const now = Date.now();
  const seedMsgs: Omit<GroupMessage, "id">[] = [
    {
      event_id: "evt_demo_friday",
      user_id: "user_maya",
      content: "Friday night — who is in?",
      kind: "text",
      created_at: new Date(now - 3600_000).toISOString(),
    },
    {
      event_id: "evt_demo_friday",
      user_id: "user_jordan",
      content: "I'm down. Budget ~$120.",
      kind: "text",
      created_at: new Date(now - 3400_000).toISOString(),
    },
    {
      event_id: "evt_demo_friday",
      user_id: "user_sam",
      content: "Same. Drop a reel if you see a spot.",
      kind: "text",
      created_at: new Date(now - 3200_000).toISOString(),
    },
    {
      event_id: "evt_demo_miami",
      user_id: "user_maya",
      content: "Weekend trip thread — paste Instagram reels here.",
      kind: "text",
      created_at: new Date(now - 7200_000).toISOString(),
    },
  ];
  for (const m of seedMsgs) {
    const id = randomUUID();
    store.messages.set(id, { ...m, id });
  }

  store.seeded = true;
}

export function listUsers(): AppUser[] {
  ensureSocialSeeded();
  return [...getSocialStore().users.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getUserById(id: string): AppUser | undefined {
  ensureSocialSeeded();
  return getSocialStore().users.get(id);
}

export function findUserByHandleOrName(query: string): AppUser | undefined {
  ensureSocialSeeded();
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return undefined;
  const users = listUsers();
  return (
    users.find((u) => u.handle === q) ||
    users.find((u) => u.name.toLowerCase() === q) ||
    users.find((u) => u.email?.toLowerCase() === q) ||
    users.find((u) => u.id === query.trim())
  );
}

export function upsertUser(user: AppUser) {
  ensureSocialSeeded();
  getSocialStore().users.set(user.id, user);
  return user;
}

export function createUser(input: {
  name: string;
  email?: string;
  handle?: string;
  channel?: Channel;
}): AppUser {
  ensureSocialSeeded();
  const handle = slugHandle(input.handle || input.name);
  const existing = findUserByHandleOrName(handle);
  if (existing) {
    // Reuse by handle; refresh display name if caller provided one
    if (
      input.name.trim() &&
      existing.name.toLowerCase() !== input.name.trim().toLowerCase() &&
      existing.handle === handle
    ) {
      return existing;
    }
    return existing;
  }
  const baseId = `user_${handle}`;
  if (getSocialStore().users.has(baseId)) {
    const id = `${baseId}_${randomUUID().slice(0, 4)}`;
    return upsertUser({
      id,
      name: input.name.trim(),
      email: input.email?.trim(),
      handle: `${handle}${randomUUID().slice(0, 3)}`,
      channel: input.channel ?? "web",
      created_at: new Date().toISOString(),
    });
  }
  return upsertUser({
    id: baseId,
    name: input.name.trim(),
    email: input.email?.trim(),
    handle,
    channel: input.channel ?? "web",
    created_at: new Date().toISOString(),
  });
}

function friendshipKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function listFriendships(userId: string): Friendship[] {
  ensureSocialSeeded();
  return [...getSocialStore().friendships.values()].filter(
    (f) => f.user_id === userId || f.friend_id === userId,
  );
}

export function listFriends(userId: string): AppUser[] {
  const rows = listFriendships(userId).filter((f) => f.status === "accepted");
  return rows
    .map((f) => getUserById(f.user_id === userId ? f.friend_id : f.user_id))
    .filter((u): u is AppUser => Boolean(u));
}

export function addFriend(userId: string, friendId: string): Friendship {
  ensureSocialSeeded();
  if (userId === friendId) throw new Error("Cannot friend yourself");
  if (!getUserById(userId) || !getUserById(friendId)) {
    throw new Error("User not found");
  }
  const existing = listFriendships(userId).find(
    (f) =>
      friendshipKey(f.user_id, f.friend_id) === friendshipKey(userId, friendId),
  );
  if (existing) {
    if (existing.status === "pending") {
      const accepted = { ...existing, status: "accepted" as const };
      getSocialStore().friendships.set(accepted.id, accepted);
      return accepted;
    }
    return existing;
  }
  const friendship: Friendship = {
    id: randomUUID(),
    user_id: userId,
    friend_id: friendId,
    status: "accepted",
    created_at: new Date().toISOString(),
  };
  getSocialStore().friendships.set(friendship.id, friendship);
  return friendship;
}

export function listGroupMessages(eventId: string): GroupMessage[] {
  ensureSocialSeeded();
  return [...getSocialStore().messages.values()]
    .filter((m) => m.event_id === eventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addGroupMessage(input: {
  event_id: string;
  user_id: string;
  content: string;
  kind?: GroupMessage["kind"];
  meta?: Record<string, unknown>;
}): GroupMessage {
  ensureSocialSeeded();
  const msg: GroupMessage = {
    id: randomUUID(),
    event_id: input.event_id,
    user_id: input.user_id,
    content: input.content.trim(),
    kind: input.kind ?? "text",
    meta: input.meta,
    created_at: new Date().toISOString(),
  };
  getSocialStore().messages.set(msg.id, msg);
  return msg;
}

export function listExpenses(eventId: string): Expense[] {
  ensureSocialSeeded();
  return [...getSocialStore().expenses.values()]
    .filter((e) => e.event_id === eventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function upsertExpense(expense: Expense) {
  ensureSocialSeeded();
  getSocialStore().expenses.set(expense.id, expense);
  return expense;
}

export function addExpense(input: Omit<Expense, "id" | "created_at">): Expense {
  return upsertExpense({
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });
}

export function listSettlements(eventId: string): Settlement[] {
  ensureSocialSeeded();
  return [...getSocialStore().settlements.values()]
    .filter((s) => s.event_id === eventId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addSettlement(
  input: Omit<Settlement, "id" | "created_at">,
): Settlement {
  ensureSocialSeeded();
  const row: Settlement = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  getSocialStore().settlements.set(row.id, row);
  return row;
}

export function resetSocialStore() {
  globalForSocial.__aidhdSocialStore = createSocialStore();
  ensureSocialSeeded();
}
