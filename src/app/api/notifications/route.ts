import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const notifications = await listNotifications(user.id);
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.read_at).length,
  });
}

/** Mark notifications read — { ids?: string[] } (all unread when omitted). */
export async function POST(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let body: { ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // mark all
  }
  await markNotificationsRead(user.id, body.ids);
  return NextResponse.json({ ok: true });
}
