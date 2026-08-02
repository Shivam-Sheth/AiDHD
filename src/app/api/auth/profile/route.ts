import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  // Scope this client to the caller's JWT so `auth.uid()` resolves for RLS —
  // writes go through the anon key, not a service role.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;

  let body: { phone?: string; username?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // body is optional (Google OAuth callback sends none)
  }

  const phone =
    body.phone?.trim() ||
    (user.user_metadata?.phone as string | undefined) ||
    null;
  const username = body.username?.trim()?.toLowerCase() || null;

  const row: Record<string, unknown> = { id: user.id, email: user.email, name };
  if (phone) row.phone = phone;
  if (username) row.username = username;

  let { error: upsertError } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" });

  // Older projects may not have run upgrade_v2.sql yet — retry without the
  // new columns so sign-in never breaks on schema drift.
  if (upsertError && (phone || username)) {
    ({ error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email, name }, { onConflict: "id" }));
  }

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
