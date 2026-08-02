import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  disconnectCalendar,
  getCalendarConnection,
  googleCalendarConfigured,
} from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const conn = await getCalendarConnection(user.id);
  return NextResponse.json({
    connected: conn.connected,
    email: conn.email,
    oauth_configured: googleCalendarConfigured(),
  });
}

export async function DELETE(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await disconnectCalendar(user.id);
  return NextResponse.json({ ok: true });
}
