import { NextRequest, NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import {
  createServiceClient,
  createUserClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";
import { upsertTraveler } from "@/lib/vault/traveler-store";

export async function POST(req: NextRequest) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const userClient = createUserClient(token);
  if (!userClient) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    handle?: string;
  };

  const name =
    body.name?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;
  const phone =
    body.phone?.trim() ||
    (user.user_metadata?.phone as string | undefined) ||
    null;

  // Prefer service role for durable profile writes; fall back to user JWT (RLS).
  const admin = createServiceClient();
  try {
    const profile = await repo.ensureProfile(admin, {
      id: user.id,
      email: user.email,
      name,
      handle: body.handle,
      phone,
    });

    // Also upsert via user client when service role missing but profiles RLS allows it
    if (!admin) {
      await userClient.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          name: profile.name,
          handle: profile.handle,
          phone: profile.phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    }

    await upsertTraveler({
      user_id: user.id,
      email: profile.email,
      display_name: profile.name || "",
      phone: profile.phone,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile upsert failed" },
      { status: 500 },
    );
  }
}
