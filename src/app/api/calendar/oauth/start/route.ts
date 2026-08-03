import { NextResponse } from "next/server";
import { resolveGroupUser } from "@/lib/groups/auth";
import {
  buildOAuthUrl,
  googleCalendarConfigured,
  saveCalendarConnection,
} from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off Google Calendar OAuth for the signed-in user.
 * GET so it can be a plain link; the caller passes identity headers via
 * fetch → we return the consent URL for the client to navigate to.
 */
export async function POST(req: Request) {
  const user = await resolveGroupUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const origin = new URL(req.url).origin;

  if (!googleCalendarConfigured()) {
    // Demo mode: mark a mock connection so flows remain demoable.
    await saveCalendarConnection({
      userId: user.id,
      tokens: { access_token: "", expires_at: 0 },
      email: user.email || "demo@calendar.local",
    });
    return NextResponse.json({
      ok: true,
      mode: "mock",
      message:
        "Google OAuth isn't configured (GOOGLE_OAUTH_CLIENT_ID/SECRET) — connected in demo mode.",
    });
  }

  const url = buildOAuthUrl(user.id, origin);
  return NextResponse.json({ ok: true, mode: "live", url });
}
