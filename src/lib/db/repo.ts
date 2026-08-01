import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseDbConfigured } from "@/lib/supabase/env";
import { mem } from "./memory";
import type {
  Friendship,
  GroupExpense,
  GroupMessage,
  GroupSettlement,
  Profile,
  TripGroup,
  TripGroupMember,
} from "./types";

function slugHandle(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "")
      .slice(0, 24) || `user${Math.random().toString(36).slice(2, 6)}`
  );
}

/** App tables use the service role. Without it we keep an in-process store keyed by real auth user ids. */
function useMemory(admin: SupabaseClient | null) {
  return !isSupabaseDbConfigured() || !admin;
}

export async function ensureProfile(
  admin: SupabaseClient | null,
  input: {
    id: string;
    email?: string | null;
    name?: string | null;
    handle?: string | null;
    phone?: string | null;
  },
): Promise<Profile> {
  const email = input.email?.trim() || "";
  const name = input.name?.trim() || email.split("@")[0] || "Traveler";
  const handle =
    input.handle?.trim().replace(/^@/, "") ||
    slugHandle(email.split("@")[0] || name);
  const now = new Date().toISOString();

  if (useMemory(admin)) {
    const prev = mem.getProfile(input.id);
    return mem.upsertProfile({
      id: input.id,
      email: email || prev?.email || "",
      name: input.name !== undefined ? name : prev?.name || name,
      handle: prev?.handle || handle,
      phone: input.phone ?? prev?.phone ?? null,
      avatar_url: prev?.avatar_url ?? null,
      updated_at: now,
    });
  }

  const { data: existing } = await admin!
    .from("profiles")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  const row = {
    id: input.id,
    email: email || existing?.email || "",
    name: input.name !== undefined ? name : existing?.name || name,
    handle: existing?.handle || handle,
    phone: input.phone !== undefined ? input.phone : existing?.phone ?? null,
    updated_at: now,
  };

  const { data, error } = await admin!
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function getProfile(
  admin: SupabaseClient | null,
  id: string,
): Promise<Profile | null> {
  if (useMemory(admin)) return mem.getProfile(id);
  const { data, error } = await admin!
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) || null;
}

export async function searchProfiles(
  admin: SupabaseClient | null,
  query: string,
  excludeId?: string,
): Promise<Profile[]> {
  const q = query.trim().replace(/^@/, "");
  if (!q) return [];

  if (useMemory(admin)) {
    return mem
      .findProfiles(q)
      .filter((p) => p.id !== excludeId)
      .slice(0, 20);
  }

  const needle = q.toLowerCase();
  const { data, error } = await admin!
    .from("profiles")
    .select("*")
    .or(
      `email.ilike.%${needle}%,handle.ilike.%${needle}%,name.ilike.%${needle}%`,
    )
    .limit(20);

  if (error) throw new Error(error.message);
  return ((data || []) as Profile[]).filter((p) => p.id !== excludeId);
}

export async function listFriends(
  admin: SupabaseClient | null,
  userId: string,
): Promise<Profile[]> {
  if (useMemory(admin)) {
    const ids = mem
      .listFriendships(userId)
      .filter((f) => f.status === "accepted")
      .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
    return ids
      .map((id) => mem.getProfile(id))
      .filter((p): p is Profile => Boolean(p));
  }

  const { data, error } = await admin!
    .from("friendships")
    .select("*")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw new Error(error.message);

  const ids = ((data || []) as Friendship[]).map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id,
  );
  if (!ids.length) return [];

  const { data: profiles, error: pErr } = await admin!
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);
  return (profiles || []) as Profile[];
}

export async function addFriend(
  admin: SupabaseClient | null,
  userId: string,
  friendId: string,
): Promise<{ friendship: Friendship; friend: Profile }> {
  if (userId === friendId) throw new Error("Cannot friend yourself");
  const friend = await getProfile(admin, friendId);
  if (!friend) throw new Error("User not found");

  if (useMemory(admin)) {
    const existing = mem.listFriendships(userId).find((f) => {
      const a = [f.requester_id, f.addressee_id].sort().join(":");
      const b = [userId, friendId].sort().join(":");
      return a === b;
    });
    if (existing) {
      const accepted = { ...existing, status: "accepted" as const };
      mem.addFriendship(accepted);
      return { friendship: accepted, friend };
    }
    const friendship: Friendship = {
      id: randomUUID(),
      requester_id: userId,
      addressee_id: friendId,
      status: "accepted",
      created_at: new Date().toISOString(),
    };
    mem.addFriendship(friendship);
    return { friendship, friend };
  }

  const { data: existingRows } = await admin!
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
    )
    .limit(1);

  const existing = (existingRows || [])[0] as Friendship | undefined;
  if (existing) {
    if (existing.status !== "accepted") {
      const { data, error } = await admin!
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { friendship: data as Friendship, friend };
    }
    return { friendship: existing, friend };
  }

  const { data, error } = await admin!
    .from("friendships")
    .insert({
      requester_id: userId,
      addressee_id: friendId,
      status: "accepted",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { friendship: data as Friendship, friend };
}

export async function createGroup(
  admin: SupabaseClient | null,
  input: {
    name: string;
    destination?: string;
    created_by: string;
    member_ids?: string[];
    source_reel_url?: string | null;
    trip_brief?: Record<string, unknown>;
  },
): Promise<{ group: TripGroup; members: Profile[] }> {
  const now = new Date().toISOString();
  const memberIds = [
    ...new Set([input.created_by, ...(input.member_ids || [])]),
  ];

  if (useMemory(admin)) {
    const group: TripGroup = {
      id: randomUUID(),
      name: input.name.trim() || "Group trip",
      destination: input.destination?.trim() || "TBD",
      created_by: input.created_by,
      status: "planning",
      booking_event_id: null,
      source_reel_url: input.source_reel_url ?? null,
      trip_brief: input.trip_brief ?? {},
      created_at: now,
      updated_at: now,
    };
    mem.createGroup(group, input.created_by);
    for (const uid of memberIds) {
      if (uid === input.created_by) continue;
      mem.addMember({
        group_id: group.id,
        user_id: uid,
        role: "member",
        joined_at: now,
      });
    }
    mem.addMessage({
      id: randomUUID(),
      group_id: group.id,
      user_id: null,
      content:
        "Group created. Chat here — @AiDHD is in this chat and can plan & book the trip.",
      kind: "system",
      meta: {},
      created_at: now,
    });
    const members = memberIds
      .map((id) => mem.getProfile(id))
      .filter((p): p is Profile => Boolean(p));
    return { group, members };
  }

  const { data: group, error } = await admin!
    .from("trip_groups")
    .insert({
      name: input.name.trim() || "Group trip",
      destination: input.destination?.trim() || "TBD",
      created_by: input.created_by,
      status: "planning",
      source_reel_url: input.source_reel_url ?? null,
      trip_brief: input.trip_brief ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const memberRows = memberIds.map((user_id) => ({
    group_id: (group as TripGroup).id,
    user_id,
    role: user_id === input.created_by ? "owner" : "member",
  }));

  const { error: mErr } = await admin!.from("trip_group_members").insert(memberRows);
  if (mErr) throw new Error(mErr.message);

  await admin!.from("group_messages").insert({
    group_id: (group as TripGroup).id,
    user_id: null,
    content:
      "Group created. Chat here — @AiDHD is in this chat and can plan & book the trip.",
    kind: "system",
    meta: {},
  });

  const { data: profiles } = await admin!
    .from("profiles")
    .select("*")
    .in("id", memberIds);

  return {
    group: group as TripGroup,
    members: (profiles || []) as Profile[],
  };
}

export async function listGroups(
  admin: SupabaseClient | null,
  userId: string,
): Promise<TripGroup[]> {
  if (useMemory(admin)) return mem.listGroupsForUser(userId);

  const { data: memberships, error } = await admin!
    .from("trip_group_members")
    .select("group_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const ids = (memberships || []).map((m) => m.group_id as string);
  if (!ids.length) return [];

  const { data, error: gErr } = await admin!
    .from("trip_groups")
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false });
  if (gErr) throw new Error(gErr.message);
  return (data || []) as TripGroup[];
}

export async function getGroup(
  admin: SupabaseClient | null,
  groupId: string,
): Promise<TripGroup | null> {
  if (useMemory(admin)) return mem.getGroup(groupId);
  const { data, error } = await admin!
    .from("trip_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TripGroup) || null;
}

export async function updateGroup(
  admin: SupabaseClient | null,
  groupId: string,
  patch: Partial<TripGroup>,
): Promise<TripGroup | null> {
  if (useMemory(admin)) return mem.updateGroup(groupId, patch);
  const { data, error } = await admin!
    .from("trip_groups")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", groupId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TripGroup;
}

export async function assertMember(
  admin: SupabaseClient | null,
  groupId: string,
  userId: string,
): Promise<boolean> {
  if (useMemory(admin)) return mem.isMember(groupId, userId);
  const { data, error } = await admin!
    .from("trip_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function listMembers(
  admin: SupabaseClient | null,
  groupId: string,
): Promise<(TripGroupMember & { profile: Profile | null })[]> {
  if (useMemory(admin)) {
    return mem.listMembers(groupId).map((m) => ({
      ...m,
      profile: mem.getProfile(m.user_id),
    }));
  }
  const { data, error } = await admin!
    .from("trip_group_members")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  const rows = (data || []) as TripGroupMember[];
  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await admin!
    .from("profiles")
    .select("*")
    .in("id", ids);
  const map = new Map(((profiles || []) as Profile[]).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
}

export async function addMembers(
  admin: SupabaseClient | null,
  groupId: string,
  userIds: string[],
): Promise<string[]> {
  const added: string[] = [];
  const now = new Date().toISOString();

  for (const userId of userIds) {
    if (await assertMember(admin, groupId, userId)) continue;
    if (useMemory(admin)) {
      mem.addMember({
        group_id: groupId,
        user_id: userId,
        role: "member",
        joined_at: now,
      });
      added.push(userId);
      continue;
    }
    const { error } = await admin!.from("trip_group_members").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
    });
    if (!error) added.push(userId);
  }

  if (added.length) {
    await updateGroup(admin, groupId, {});
  }
  return added;
}

export async function listMessages(
  admin: SupabaseClient | null,
  groupId: string,
  limit = 200,
): Promise<(GroupMessage & { profile: Profile | null })[]> {
  if (useMemory(admin)) {
    return mem.listMessages(groupId, limit).map((m) => ({
      ...m,
      profile: m.user_id ? mem.getProfile(m.user_id) : null,
    }));
  }

  const { data, error } = await admin!
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data || []) as GroupMessage[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  let map = new Map<string, Profile>();
  if (ids.length) {
    const { data: profiles } = await admin!
      .from("profiles")
      .select("*")
      .in("id", ids);
    map = new Map(((profiles || []) as Profile[]).map((p) => [p.id, p]));
  }
  return rows.map((m) => ({
    ...m,
    profile: m.user_id ? map.get(m.user_id) ?? null : null,
  }));
}

export async function addMessage(
  admin: SupabaseClient | null,
  input: {
    group_id: string;
    user_id: string | null;
    content: string;
    kind?: GroupMessage["kind"];
    meta?: Record<string, unknown>;
  },
): Promise<GroupMessage> {
  const row = {
    group_id: input.group_id,
    user_id: input.user_id,
    content: input.content.trim(),
    kind: input.kind ?? "text",
    meta: input.meta ?? {},
  };

  if (useMemory(admin)) {
    const msg: GroupMessage = {
      id: randomUUID(),
      ...row,
      created_at: new Date().toISOString(),
    };
    mem.addMessage(msg);
    mem.updateGroup(input.group_id, {});
    return msg;
  }

  const { data, error } = await admin!
    .from("group_messages")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await admin!
    .from("trip_groups")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.group_id);
  return data as GroupMessage;
}

export async function listExpenses(
  admin: SupabaseClient | null,
  groupId: string,
): Promise<GroupExpense[]> {
  if (useMemory(admin)) return mem.listExpenses(groupId);
  const { data, error } = await admin!
    .from("group_expenses")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as GroupExpense[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
    splits: (e.splits || []) as GroupExpense["splits"],
  }));
}

export async function addExpense(
  admin: SupabaseClient | null,
  input: Omit<GroupExpense, "id" | "created_at">,
): Promise<GroupExpense> {
  if (useMemory(admin)) {
    const e: GroupExpense = {
      ...input,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    return mem.addExpense(e);
  }
  const { data, error } = await admin!
    .from("group_expenses")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const e = data as GroupExpense;
  return { ...e, amount: Number(e.amount) };
}

export async function listSettlements(
  admin: SupabaseClient | null,
  groupId: string,
): Promise<GroupSettlement[]> {
  if (useMemory(admin)) return mem.listSettlements(groupId);
  const { data, error } = await admin!
    .from("group_settlements")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as GroupSettlement[]).map((s) => ({
    ...s,
    amount: Number(s.amount),
  }));
}

export async function addSettlement(
  admin: SupabaseClient | null,
  input: Omit<GroupSettlement, "id" | "created_at">,
): Promise<GroupSettlement> {
  if (useMemory(admin)) {
    const s: GroupSettlement = {
      ...input,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    return mem.addSettlement(s);
  }
  const { data, error } = await admin!
    .from("group_settlements")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const s = data as GroupSettlement;
  return { ...s, amount: Number(s.amount) };
}
