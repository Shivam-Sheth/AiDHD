/**
 * Server → client live updates via Supabase Realtime broadcast.
 *
 * We broadcast lightweight signals only (event names + ids) — never message
 * plaintext — so clients re-fetch through the authenticated REST APIs.
 * Broadcast needs no table replication or RLS policies, and works for both
 * Supabase-auth users and demo local users.
 */

export function realtimeConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function groupChannelName(groupId: string): string {
  return `group:${groupId}`;
}

export type GroupRealtimeEvent =
  | "message"
  | "message_updated"
  | "reaction"
  | "member"
  | "poll"
  | "approval"
  | "read";

/** Fire-and-forget broadcast to everyone viewing this group. */
export async function broadcastGroupEvent(
  groupId: string,
  event: GroupRealtimeEvent,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!realtimeConfigured()) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: groupChannelName(groupId),
            event,
            payload: { ...payload, at: Date.now() },
          },
        ],
      }),
    });
  } catch {
    // Realtime is best-effort — clients also poll as a fallback.
  }
}

/** Notify a specific user's personal channel (notifications badge, etc). */
export async function broadcastUserEvent(
  userId: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!realtimeConfigured()) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `user:${userId}`,
            event,
            payload: { ...payload, at: Date.now() },
          },
        ],
      }),
    });
  } catch {
    // best-effort
  }
}
