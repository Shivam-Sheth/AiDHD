/**
 * Group parties — Supabase when configured, in-memory otherwise
 * (same pattern as traveler-store / durable WhatsApp state).
 */

import { randomBytes, randomUUID } from "crypto";
import { broadcastGroupEvent } from "@/lib/realtime/broadcast";
import {
  decryptMessageBody,
  encryptMessageBody,
  mintGroupChatKey,
  unwrapGroupChatKey,
} from "./crypto";
import {
  AIDHD_BOT_ID,
  AIDHD_BOT_NAME,
  type BookingCategory,
  type GroupBookingDraft,
  type GroupInvite,
  type GroupMember,
  type GroupMessage,
  type GroupMode,
  type GroupParty,
  type MemberChannel,
  type MemberRole,
  type MessageKind,
  type TravelerSlot,
} from "./types";

export function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Service-role PostgREST fetch — shared by the group domain modules. */
export async function sb(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, data, status: res.status };
}

type MemoryShape = {
  groups: Map<string, GroupParty>;
  members: Map<string, GroupMember[]>;
  invites: Map<string, GroupInvite>;
  messages: Map<string, GroupMessage[]>;
  drafts: Map<string, GroupBookingDraft>;
};

const globalForGroups = globalThis as unknown as {
  __aidhdGroups?: MemoryShape;
};

function mem(): MemoryShape {
  if (!globalForGroups.__aidhdGroups) {
    globalForGroups.__aidhdGroups = {
      groups: new Map(),
      members: new Map(),
      invites: new Map(),
      messages: new Map(),
      drafts: new Map(),
    };
  }
  return globalForGroups.__aidhdGroups;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "party"}-${randomBytes(3).toString("hex")}`;
}

function rowToGroup(row: Record<string, unknown>): GroupParty {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    mode: row.mode as GroupMode,
    place: String(row.place ?? "TBD"),
    proposed_dates: Array.isArray(row.proposed_dates)
      ? (row.proposed_dates as string[])
      : [],
    status: row.status as GroupParty["status"],
    organizer_id: String(row.organizer_id),
    spoc_user_id: (row.spoc_user_id as string | null) ?? null,
    chat_key_wrapped: String(row.chat_key_wrapped),
    legacy_event_id: (row.legacy_event_id as string | null) ?? null,
    linq_chat_id: (row.linq_chat_id as string | null) ?? null,
    whatsapp_thread_hint: (row.whatsapp_thread_hint as string | null) ?? null,
    plan_summary:
      (row.plan_summary as Record<string, unknown>) &&
      typeof row.plan_summary === "object"
        ? (row.plan_summary as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createGroup(input: {
  title: string;
  mode: GroupMode;
  place?: string;
  proposed_dates?: string[];
  organizer: { id: string; name: string; email?: string };
  legacy_event_id?: string;
}): Promise<{ group: GroupParty; invite: GroupInvite }> {
  const { raw, wrapped } = mintGroupChatKey();
  void raw;
  const now = new Date().toISOString();
  const id = randomUUID();
  const slug = slugify(input.title);

  const group: GroupParty = {
    id,
    slug,
    title: input.title.trim() || "Untitled party",
    mode: input.mode,
    place: input.place?.trim() || "TBD",
    proposed_dates: input.proposed_dates ?? [],
    status: "collecting",
    organizer_id: input.organizer.id,
    spoc_user_id: null,
    chat_key_wrapped: wrapped,
    legacy_event_id: input.legacy_event_id ?? null,
    linq_chat_id: null,
    whatsapp_thread_hint: null,
    plan_summary: {},
    created_at: now,
    updated_at: now,
  };

  const organizer: GroupMember = {
    group_id: id,
    user_id: input.organizer.id,
    display_name: input.organizer.name,
    email: input.organizer.email || "",
    role: "organizer",
    channel: "web",
    joined_at: now,
  };

  const bot: GroupMember = {
    group_id: id,
    user_id: AIDHD_BOT_ID,
    display_name: AIDHD_BOT_NAME,
    email: "",
    role: "bot",
    channel: "system",
    joined_at: now,
  };

  const invite: GroupInvite = {
    token: randomBytes(16).toString("hex"),
    group_id: id,
    created_by: input.organizer.id,
    max_uses: 50,
    uses: 0,
    expires_at: null,
    created_at: now,
  };

  if (supabaseConfigured()) {
    const g = await sb("groups", {
      method: "POST",
      body: JSON.stringify({
        id: group.id,
        slug: group.slug,
        title: group.title,
        mode: group.mode,
        place: group.place,
        proposed_dates: group.proposed_dates,
        status: group.status,
        organizer_id: group.organizer_id,
        chat_key_wrapped: group.chat_key_wrapped,
        legacy_event_id: group.legacy_event_id,
        plan_summary: {},
      }),
    });
    if (!g.ok) {
      // Fall through to memory so local demos still work if SQL not applied yet.
      console.warn("[groups] Supabase insert failed, using memory", g.status, g.data);
    } else {
      await sb("group_members", {
        method: "POST",
        body: JSON.stringify([
          {
            group_id: organizer.group_id,
            user_id: organizer.user_id,
            display_name: organizer.display_name,
            email: organizer.email,
            role: organizer.role,
            channel: organizer.channel,
          },
          {
            group_id: bot.group_id,
            user_id: bot.user_id,
            display_name: bot.display_name,
            email: "",
            role: bot.role,
            channel: bot.channel,
          },
        ]),
      });
      await sb("group_invites", {
        method: "POST",
        body: JSON.stringify({
          token: invite.token,
          group_id: invite.group_id,
          created_by: invite.created_by,
          max_uses: invite.max_uses,
          uses: 0,
        }),
      });
    }
  }

  const m = mem();
  m.groups.set(id, group);
  m.members.set(id, [organizer, bot]);
  m.invites.set(invite.token, invite);
  m.messages.set(id, []);

  // Mirror into the WhatsApp/collector Event store so channel invites work.
  try {
    const { upsertEvent } = await import("@/lib/store");
    upsertEvent({
      id: group.id,
      type: group.mode,
      title: group.title,
      destination_or_venue: group.place,
      proposed_dates: group.proposed_dates,
      organizer_id: group.organizer_id,
      invitee_ids: [group.organizer_id],
      status: "collecting",
      created_via: "web",
      created_at: group.created_at,
    });
    group.legacy_event_id = group.id;
  } catch {
    // non-fatal in edge cases
  }

  await appendMessage({
    groupId: id,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: `Hey — I'm Prava, sitting in this group like Meta AI does in WhatsApp. Tag me with @Prava when you want flights, hotels, restaurants, tickets, polls, a plan, or to start a booking. I'll always ask for your approval before paying, booking, calling, or touching your calendar. Use Invite friends for a web link, email, phone, WhatsApp, or iMessage.`,
    kind: "agent",
  });

  return { group, invite };
}

export async function listGroupsForUser(userId: string): Promise<GroupParty[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_members?user_id=eq.${encodeURIComponent(userId)}&select=group_id`,
    );
    if (ok && Array.isArray(data) && data.length) {
      const ids = (data as { group_id: string }[]).map((r) => r.group_id);
      const q = `groups?id=in.(${ids.join(",")})&order=created_at.desc`;
      const g = await sb(q);
      if (g.ok && Array.isArray(g.data)) {
        return (g.data as Record<string, unknown>[]).map(rowToGroup);
      }
    }
  }
  const m = mem();
  const out: GroupParty[] = [];
  for (const [gid, members] of m.members) {
    if (members.some((x) => x.user_id === userId)) {
      const g = m.groups.get(gid);
      if (g) out.push(g);
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getGroup(groupId: string): Promise<GroupParty | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(`groups?id=eq.${groupId}&limit=1`);
    if (ok && Array.isArray(data) && data[0]) {
      const g = rowToGroup(data[0] as Record<string, unknown>);
      mem().groups.set(g.id, g);
      return g;
    }
  }
  return mem().groups.get(groupId) ?? null;
}

export async function getGroupBySlug(slug: string): Promise<GroupParty | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `groups?slug=eq.${encodeURIComponent(slug)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      return rowToGroup(data[0] as Record<string, unknown>);
    }
  }
  for (const g of mem().groups.values()) {
    if (g.slug === slug) return g;
  }
  return null;
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_members?group_id=eq.${groupId}&order=joined_at.asc`,
    );
    if (ok && Array.isArray(data)) {
      const members = (data as Record<string, unknown>[]).map((row) => ({
        group_id: String(row.group_id),
        user_id: String(row.user_id),
        display_name: String(row.display_name ?? ""),
        email: String(row.email ?? ""),
        phone: (row.phone as string | null) ?? null,
        role: row.role as MemberRole,
        channel: row.channel as MemberChannel,
        joined_at: String(row.joined_at),
      }));
      mem().members.set(groupId, members);
      return members;
    }
  }
  return mem().members.get(groupId) ?? [];
}

export async function isMember(
  groupId: string,
  userId: string,
): Promise<boolean> {
  const members = await listMembers(groupId);
  return members.some((m) => m.user_id === userId);
}

export async function addMember(input: {
  groupId: string;
  userId: string;
  displayName: string;
  email?: string;
  phone?: string;
  channel?: MemberChannel;
  role?: MemberRole;
}): Promise<GroupMember> {
  const now = new Date().toISOString();
  const member: GroupMember = {
    group_id: input.groupId,
    user_id: input.userId,
    display_name: input.displayName,
    email: input.email || "",
    phone: input.phone ?? null,
    role: input.role ?? "member",
    channel: input.channel ?? "web",
    joined_at: now,
  };

  const existing = await listMembers(input.groupId);
  if (existing.some((m) => m.user_id === input.userId)) {
    return existing.find((m) => m.user_id === input.userId)!;
  }

  if (supabaseConfigured()) {
    await sb("group_members", {
      method: "POST",
      body: JSON.stringify({
        group_id: member.group_id,
        user_id: member.user_id,
        display_name: member.display_name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        channel: member.channel,
      }),
    });
  }

  const list = mem().members.get(input.groupId) ?? [];
  list.push(member);
  mem().members.set(input.groupId, list);

  await appendMessage({
    groupId: input.groupId,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: `${member.display_name} joined the party.`,
    kind: "system",
  });

  return member;
}

export async function setSpoc(
  groupId: string,
  userId: string,
): Promise<GroupParty | null> {
  const group = await getGroup(groupId);
  if (!group) return null;
  const members = await listMembers(groupId);
  if (!members.some((m) => m.user_id === userId && m.role !== "bot")) {
    return null;
  }

  group.spoc_user_id = userId;
  group.updated_at = new Date().toISOString();

  if (supabaseConfigured()) {
    await sb(`groups?id=eq.${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({
        spoc_user_id: userId,
        updated_at: group.updated_at,
      }),
    });
    await sb(
      `group_members?group_id=eq.${groupId}&role=eq.spoc`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "member" }),
      },
    );
    await sb(
      `group_members?group_id=eq.${groupId}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "spoc" }),
      },
    );
  }

  const list = mem().members.get(groupId) ?? [];
  for (const m of list) {
    if (m.role === "spoc") m.role = "member";
    if (m.user_id === userId) m.role = "spoc";
  }
  mem().groups.set(groupId, group);

  const name =
    members.find((m) => m.user_id === userId)?.display_name || "Someone";
  await appendMessage({
    groupId,
    senderId: AIDHD_BOT_ID,
    senderName: AIDHD_BOT_NAME,
    body: `${name} volunteered as SPOC — I'll put their name on the reservation and confirm headcount with the group.`,
    kind: "spoc_ask",
    meta: { spoc_user_id: userId },
  });

  return group;
}

export async function getInvite(token: string): Promise<GroupInvite | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_invites?token=eq.${encodeURIComponent(token)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      const row = data[0] as Record<string, unknown>;
      return {
        token: String(row.token),
        group_id: String(row.group_id),
        created_by: String(row.created_by),
        max_uses: Number(row.max_uses ?? 50),
        uses: Number(row.uses ?? 0),
        expires_at: (row.expires_at as string | null) ?? null,
        created_at: String(row.created_at),
      };
    }
  }
  return mem().invites.get(token) ?? null;
}

export async function createInvite(
  groupId: string,
  createdBy: string,
  target?: {
    email?: string;
    phone?: string;
    username?: string;
    role?: "admin" | "member";
    maxUses?: number;
  },
): Promise<GroupInvite> {
  const invite: GroupInvite = {
    token: randomBytes(16).toString("hex"),
    group_id: groupId,
    created_by: createdBy,
    max_uses: target?.maxUses ?? (target?.email || target?.phone || target?.username ? 1 : 50),
    uses: 0,
    expires_at: null,
    invited_email: target?.email || null,
    invited_phone: target?.phone || null,
    invited_username: target?.username || null,
    role: target?.role || "member",
    created_at: new Date().toISOString(),
  };
  if (supabaseConfigured()) {
    const res = await sb("group_invites", {
      method: "POST",
      body: JSON.stringify({
        token: invite.token,
        group_id: invite.group_id,
        created_by: invite.created_by,
        max_uses: invite.max_uses,
        uses: 0,
        invited_email: invite.invited_email,
        invited_phone: invite.invited_phone,
        invited_username: invite.invited_username,
        role: invite.role,
      }),
    });
    if (!res.ok) {
      // Schema drift (upgrade_v2.sql not applied) — retry without new cols.
      await sb("group_invites", {
        method: "POST",
        body: JSON.stringify({
          token: invite.token,
          group_id: invite.group_id,
          created_by: invite.created_by,
          max_uses: invite.max_uses,
          uses: 0,
        }),
      });
    }
  }
  mem().invites.set(invite.token, invite);
  return invite;
}

/** Remove a member from the group. */
export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  if (supabaseConfigured()) {
    await sb(
      `group_members?group_id=eq.${groupId}&user_id=eq.${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  }
  const list = mem().members.get(groupId) ?? [];
  mem().members.set(
    groupId,
    list.filter((m) => m.user_id !== userId),
  );
}

/** Change a member's role (owner/admin management). */
export async function setMemberRole(
  groupId: string,
  userId: string,
  role: MemberRole,
): Promise<boolean> {
  if (supabaseConfigured()) {
    await sb(
      `group_members?group_id=eq.${groupId}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      },
    );
  }
  const list = mem().members.get(groupId) ?? [];
  const found = list.find((m) => m.user_id === userId);
  if (found) found.role = role;
  return true;
}

export async function consumeInvite(token: string): Promise<GroupInvite | null> {
  const invite = await getInvite(token);
  if (!invite) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
  if (invite.uses >= invite.max_uses) return null;
  invite.uses += 1;
  if (supabaseConfigured()) {
    await sb(`group_invites?token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH",
      body: JSON.stringify({ uses: invite.uses }),
    });
  }
  mem().invites.set(token, invite);
  return invite;
}

function decryptRow(
  group: GroupParty,
  row: GroupMessage,
): GroupMessage {
  if (row.deleted_at) {
    return { ...row, body: "" };
  }
  const key = unwrapGroupChatKey(group.chat_key_wrapped);
  const body = key
    ? decryptMessageBody(key, row.body_ciphertext)
    : null;
  return { ...row, body: body ?? "[unable to decrypt]" };
}

export async function listMessages(
  groupId: string,
  limit = 80,
): Promise<GroupMessage[]> {
  const group = await getGroup(groupId);
  if (!group) return [];

  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_messages?group_id=eq.${groupId}&order=created_at.asc&limit=${limit}`,
    );
    if (ok && Array.isArray(data)) {
      return (data as Record<string, unknown>[]).map((row) =>
        decryptRow(group, rowToMessage(row)),
      );
    }
  }

  const msgs = mem().messages.get(groupId) ?? [];
  return msgs.slice(-limit).map((m) => decryptRow(group, m));
}

function rowToMessage(row: Record<string, unknown>): GroupMessage {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    sender_id: String(row.sender_id),
    sender_name: String(row.sender_name ?? ""),
    body_ciphertext: String(row.body_ciphertext),
    mentions: Array.isArray(row.mentions) ? (row.mentions as string[]) : [],
    kind: row.kind as MessageKind,
    reply_to: (row.reply_to as string | null) ?? null,
    meta:
      row.meta && typeof row.meta === "object"
        ? (row.meta as Record<string, unknown>)
        : {},
    edited_at: (row.edited_at as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

export async function getMessage(
  groupId: string,
  messageId: string,
): Promise<GroupMessage | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_messages?id=eq.${messageId}&group_id=eq.${groupId}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      return rowToMessage(data[0] as Record<string, unknown>);
    }
  }
  const msgs = mem().messages.get(groupId) ?? [];
  return msgs.find((m) => m.id === messageId) ?? null;
}

/** Edit a message body (sender only — enforced by the API layer). */
export async function editMessage(input: {
  groupId: string;
  messageId: string;
  body: string;
}): Promise<GroupMessage | null> {
  const group = await getGroup(input.groupId);
  if (!group) return null;
  const key = unwrapGroupChatKey(group.chat_key_wrapped);
  if (!key) return null;

  const editedAt = new Date().toISOString();
  const ciphertext = encryptMessageBody(key, input.body);

  if (supabaseConfigured()) {
    await sb(`group_messages?id=eq.${input.messageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        body_ciphertext: ciphertext,
        edited_at: editedAt,
      }),
    });
  }

  const list = mem().messages.get(input.groupId) ?? [];
  const found = list.find((m) => m.id === input.messageId);
  if (found) {
    found.body_ciphertext = ciphertext;
    found.body = input.body;
    found.edited_at = editedAt;
  }

  await broadcastGroupEvent(input.groupId, "message_updated", {
    message_id: input.messageId,
  });
  const updated = await getMessage(input.groupId, input.messageId);
  return updated ? decryptRow(group, updated) : null;
}

/** Soft-delete: blank the ciphertext and stamp deleted_at. */
export async function softDeleteMessage(input: {
  groupId: string;
  messageId: string;
}): Promise<boolean> {
  const group = await getGroup(input.groupId);
  if (!group) return false;
  const key = unwrapGroupChatKey(group.chat_key_wrapped);
  const deletedAt = new Date().toISOString();
  const ciphertext = key ? encryptMessageBody(key, "") : "";

  if (supabaseConfigured()) {
    await sb(`group_messages?id=eq.${input.messageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        body_ciphertext: ciphertext,
        deleted_at: deletedAt,
      }),
    });
  }

  const list = mem().messages.get(input.groupId) ?? [];
  const found = list.find((m) => m.id === input.messageId);
  if (found) {
    found.body_ciphertext = ciphertext;
    found.body = "";
    found.deleted_at = deletedAt;
  }

  await broadcastGroupEvent(input.groupId, "message_updated", {
    message_id: input.messageId,
    deleted: true,
  });
  return true;
}

export async function appendMessage(input: {
  groupId: string;
  senderId: string;
  senderName: string;
  body: string;
  kind?: MessageKind;
  mentions?: string[];
  replyTo?: string | null;
  meta?: Record<string, unknown>;
}): Promise<GroupMessage | null> {
  const group = await getGroup(input.groupId);
  if (!group) return null;
  const key = unwrapGroupChatKey(group.chat_key_wrapped);
  if (!key) return null;

  const ciphertext = encryptMessageBody(key, input.body);
  const msg: GroupMessage = {
    id: randomUUID(),
    group_id: input.groupId,
    sender_id: input.senderId,
    sender_name: input.senderName,
    body_ciphertext: ciphertext,
    body: input.body,
    mentions: input.mentions ?? [],
    kind: input.kind ?? "text",
    reply_to: input.replyTo ?? null,
    meta: input.meta ?? {},
    created_at: new Date().toISOString(),
  };

  if (supabaseConfigured()) {
    await sb("group_messages", {
      method: "POST",
      body: JSON.stringify({
        id: msg.id,
        group_id: msg.group_id,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        body_ciphertext: msg.body_ciphertext,
        mentions: msg.mentions,
        kind: msg.kind,
        reply_to: msg.reply_to,
        meta: msg.meta,
      }),
    });
  }

  const list = mem().messages.get(input.groupId) ?? [];
  list.push(msg);
  mem().messages.set(input.groupId, list);

  // Live signal — id only, never plaintext.
  await broadcastGroupEvent(input.groupId, "message", {
    message_id: msg.id,
    kind: msg.kind,
  });
  return msg;
}

export async function linkLinqChat(
  groupId: string,
  linqChatId: string,
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  group.linq_chat_id = linqChatId;
  group.updated_at = new Date().toISOString();
  if (supabaseConfigured()) {
    await sb(`groups?id=eq.${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({
        linq_chat_id: linqChatId,
        updated_at: group.updated_at,
      }),
    });
  }
  mem().groups.set(groupId, group);
}

export async function createBookingDraft(input: {
  groupId: string;
  category: BookingCategory;
  createdBy: string;
  partySize: number;
  travelers: TravelerSlot[];
  offer: Record<string, unknown>;
}): Promise<GroupBookingDraft> {
  const now = new Date().toISOString();
  const travelers = input.travelers.map((t) => ({
    ...t,
    collect_token: t.collect_token || randomBytes(12).toString("hex"),
  }));
  const draft: GroupBookingDraft = {
    id: randomUUID(),
    group_id: input.groupId,
    category: input.category,
    status: "awaiting_review",
    party_size: input.partySize,
    travelers,
    offer: input.offer,
    review_token: randomBytes(18).toString("hex"),
    created_by: input.createdBy,
    created_at: now,
    updated_at: now,
  };

  if (supabaseConfigured()) {
    await sb("group_booking_drafts", {
      method: "POST",
      body: JSON.stringify({
        id: draft.id,
        group_id: draft.group_id,
        category: draft.category,
        status: draft.status,
        party_size: draft.party_size,
        travelers: draft.travelers,
        offer: draft.offer,
        review_token: draft.review_token,
        created_by: draft.created_by,
      }),
    });
  }
  mem().drafts.set(draft.id, draft);
  mem().drafts.set(`token:${draft.review_token}`, draft);
  indexCollectTokens(draft);
  return draft;
}

function indexCollectTokens(draft: GroupBookingDraft) {
  for (const t of draft.travelers) {
    if (t.collect_token) {
      mem().drafts.set(`collect:${t.collect_token}`, draft);
    }
  }
}

export async function getBookingDraftByToken(
  token: string,
): Promise<GroupBookingDraft | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `group_booking_drafts?review_token=eq.${encodeURIComponent(token)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      const row = data[0] as Record<string, unknown>;
      return {
        id: String(row.id),
        group_id: String(row.group_id),
        category: row.category as BookingCategory,
        status: row.status as GroupBookingDraft["status"],
        party_size: Number(row.party_size ?? 1),
        travelers: Array.isArray(row.travelers)
          ? (row.travelers as TravelerSlot[])
          : [],
        offer:
          row.offer && typeof row.offer === "object"
            ? (row.offer as Record<string, unknown>)
            : {},
        review_token: String(row.review_token),
        prava_session_id: (row.prava_session_id as string | null) ?? null,
        prava_mandate_id: (row.prava_mandate_id as string | null) ?? null,
        created_by: String(row.created_by),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      };
    }
  }
  return mem().drafts.get(`token:${token}`) ?? null;
}

/** Find draft + traveler by personal passport collect token (never a passport number). */
export async function getBookingDraftByCollectToken(
  collectToken: string,
): Promise<{ draft: GroupBookingDraft; traveler: TravelerSlot } | null> {
  const fromMem = mem().drafts.get(`collect:${collectToken}`);
  if (fromMem) {
    const traveler = fromMem.travelers.find(
      (t) => t.collect_token === collectToken,
    );
    if (traveler) return { draft: fromMem, traveler };
  }

  if (supabaseConfigured()) {
    // travelers is jsonb — scan recent drafts (party bookings are short-lived)
    const { ok, data } = await sb(
      `group_booking_drafts?select=*&order=created_at.desc&limit=40`,
    );
    if (ok && Array.isArray(data)) {
      for (const row of data) {
        const travelers = Array.isArray(row.travelers)
          ? (row.travelers as TravelerSlot[])
          : [];
        const traveler = travelers.find((t) => t.collect_token === collectToken);
        if (!traveler) continue;
        const draft: GroupBookingDraft = {
          id: String(row.id),
          group_id: String(row.group_id),
          category: row.category as BookingCategory,
          status: row.status as GroupBookingDraft["status"],
          party_size: Number(row.party_size ?? 1),
          travelers,
          offer:
            row.offer && typeof row.offer === "object"
              ? (row.offer as Record<string, unknown>)
              : {},
          review_token: String(row.review_token),
          prava_session_id: (row.prava_session_id as string | null) ?? null,
          prava_mandate_id: (row.prava_mandate_id as string | null) ?? null,
          created_by: String(row.created_by),
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
        };
        indexCollectTokens(draft);
        return { draft, traveler };
      }
    }
  }
  return null;
}

export async function updateBookingDraft(
  draft: GroupBookingDraft,
): Promise<void> {
  draft.updated_at = new Date().toISOString();
  if (supabaseConfigured()) {
    await sb(`group_booking_drafts?id=eq.${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: draft.status,
        travelers: draft.travelers,
        offer: draft.offer,
        prava_session_id: draft.prava_session_id,
        prava_mandate_id: draft.prava_mandate_id,
        updated_at: draft.updated_at,
      }),
    });
  }
  mem().drafts.set(draft.id, draft);
  mem().drafts.set(`token:${draft.review_token}`, draft);
  indexCollectTokens(draft);
}
