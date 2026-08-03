import { NextResponse } from "next/server";
import {
  exchangeOAuthCode,
  saveCalendarConnection,
  verifyOAuthState,
} from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const origin = url.origin;

  const userId = verifyOAuthState(state);
  if (!code || !userId) {
    return NextResponse.redirect(`${origin}/account?calendar=error`);
  }

  const exchanged = await exchangeOAuthCode({ code, origin });
  if (!exchanged) {
    return NextResponse.redirect(`${origin}/account?calendar=error`);
  }

  await saveCalendarConnection({
    userId,
    tokens: exchanged.tokens,
    email: exchanged.email,
  });
  return NextResponse.redirect(`${origin}/account?calendar=connected`);
}
