/**
 * In-process fallback when Supabase service role isn't available.
 * Production deploys must configure Supabase — this keeps local/build workable.
 */
import { randomUUID } from "crypto";
import type {
  Friendship,
  GroupExpense,
  GroupMessage,
  GroupSettlement,
  Profile,
  TripGroup,
  TripGroupMember,
} from "./types";

type Mem = {
  profiles: Map<string, Profile>;
  friendships: Map<string, Friendship>;
  groups: Map<string, TripGroup>;
  members: Map<string, TripGroupMember>;
  messages: Map<string, GroupMessage>;
  expenses: Map<string, GroupExpense>;
  settlements: Map<string, GroupSettlement>;
};

const g = globalThis as unknown as { __aidhdProdMem?: Mem };

function store(): Mem {
  if (!g.__aidhdProdMem) {
    g.__aidhdProdMem = {
      profiles: new Map(),
      friendships: new Map(),
      groups: new Map(),
      members: new Map(),
      messages: new Map(),
      expenses: new Map(),
      settlements: new Map(),
    };
  }
  return g.__aidhdProdMem;
}

function memberKey(groupId: string, userId: string) {
  return `${groupId}:${userId}`;
}

export const mem = {
  upsertProfile(p: Profile) {
    store().profiles.set(p.id, p);
    return p;
  },
  getProfile(id: string) {
    return store().profiles.get(id) ?? null;
  },
  listProfiles() {
    return [...store().profiles.values()];
  },
  findProfiles(q: string) {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return mem.listProfiles().filter(
      (p) =>
        p.email.toLowerCase() === needle ||
        p.handle?.toLowerCase() === needle ||
        p.name?.toLowerCase() === needle ||
        p.id === q.trim(),
    );
  },
  addFriendship(f: Friendship) {
    store().friendships.set(f.id, f);
    return f;
  },
  listFriendships(userId: string) {
    return [...store().friendships.values()].filter(
      (f) => f.requester_id === userId || f.addressee_id === userId,
    );
  },
  createGroup(group: TripGroup, ownerId: string) {
    store().groups.set(group.id, group);
    store().members.set(memberKey(group.id, ownerId), {
      group_id: group.id,
      user_id: ownerId,
      role: "owner",
      joined_at: new Date().toISOString(),
    });
    return group;
  },
  getGroup(id: string) {
    return store().groups.get(id) ?? null;
  },
  updateGroup(id: string, patch: Partial<TripGroup>) {
    const prev = store().groups.get(id);
    if (!prev) return null;
    const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
    store().groups.set(id, next);
    return next;
  },
  listGroupsForUser(userId: string) {
    const ids = [...store().members.values()]
      .filter((m) => m.user_id === userId)
      .map((m) => m.group_id);
    return ids
      .map((id) => store().groups.get(id))
      .filter((g): g is TripGroup => Boolean(g))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  listMembers(groupId: string) {
    return [...store().members.values()].filter((m) => m.group_id === groupId);
  },
  isMember(groupId: string, userId: string) {
    return store().members.has(memberKey(groupId, userId));
  },
  addMember(m: TripGroupMember) {
    store().members.set(memberKey(m.group_id, m.user_id), m);
    return m;
  },
  addMessage(m: GroupMessage) {
    store().messages.set(m.id, m);
    return m;
  },
  listMessages(groupId: string, limit = 200) {
    return [...store().messages.values()]
      .filter((m) => m.group_id === groupId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-limit);
  },
  addExpense(e: GroupExpense) {
    store().expenses.set(e.id, e);
    return e;
  },
  listExpenses(groupId: string) {
    return [...store().expenses.values()]
      .filter((e) => e.group_id === groupId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  addSettlement(s: GroupSettlement) {
    store().settlements.set(s.id, s);
    return s;
  },
  listSettlements(groupId: string) {
    return [...store().settlements.values()]
      .filter((s) => s.group_id === groupId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  newId() {
    return randomUUID();
  },
};
