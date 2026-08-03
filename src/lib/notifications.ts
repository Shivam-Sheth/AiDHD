/**
 * Notification service — persisted to Supabase when configured (memory
 * otherwise) and pushed live on the user's personal realtime channel.
 */

import { randomUUID } from "crypto";
import { sb, supabaseConfigured } from "./groups/store";
import { broadcastUserEvent } from "./realtime/broadcast";

export type AppNotification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  group_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

const g = globalThis as unknown as {
  __aidhdNotifications?: Map<string, AppNotification[]>;
};
function mem() {
  if (!g.__aidhdNotifications) g.__aidhdNotifications = new Map();
  return g.__aidhdNotifications;
}

export async function notifyUser(input: {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  groupId?: string;
}): Promise<AppNotification> {
  const notification: AppNotification = {
    id: randomUUID(),
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body || "",
    link: input.link ?? null,
    group_id: input.groupId ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  if (supabaseConfigured()) {
    await sb("notifications", {
      method: "POST",
      body: JSON.stringify({
        id: notification.id,
        user_id: notification.user_id,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        group_id: notification.group_id,
      }),
    });
  }
  const list = mem().get(input.userId) ?? [];
  list.unshift(notification);
  mem().set(input.userId, list.slice(0, 100));

  await broadcastUserEvent(input.userId, "notification", {
    id: notification.id,
    title: notification.title,
  });
  return notification;
}

export async function listNotifications(
  userId: string,
  limit = 30,
): Promise<AppNotification[]> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `notifications?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${limit}`,
    );
    if (ok && Array.isArray(data)) {
      return (data as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        kind: String(row.kind ?? "info"),
        title: String(row.title),
        body: String(row.body ?? ""),
        link: (row.link as string | null) ?? null,
        group_id: (row.group_id as string | null) ?? null,
        read_at: (row.read_at as string | null) ?? null,
        created_at: String(row.created_at),
      }));
    }
  }
  return (mem().get(userId) ?? []).slice(0, limit);
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
): Promise<void> {
  const readAt = new Date().toISOString();
  if (supabaseConfigured()) {
    const filter = ids?.length
      ? `notifications?user_id=eq.${encodeURIComponent(userId)}&id=in.(${ids.join(",")})`
      : `notifications?user_id=eq.${encodeURIComponent(userId)}&read_at=is.null`;
    await sb(filter, {
      method: "PATCH",
      body: JSON.stringify({ read_at: readAt }),
    });
  }
  const list = mem().get(userId) ?? [];
  for (const n of list) {
    if (!ids?.length || ids.includes(n.id)) n.read_at = n.read_at || readAt;
  }
}
