import { NextResponse } from "next/server";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";
import {
  getPassportRef,
  savePassport,
  upsertTraveler,
} from "@/lib/vault/traveler-store";

/** Store passport ciphertext — returns vault ref only (safe for UI). */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    passport_number?: string;
    email?: string;
    display_name?: string;
  };

  const passport_number = body.passport_number?.trim();
  if (!passport_number) {
    return NextResponse.json(
      { error: "passport_number required" },
      { status: 400 },
    );
  }

  const result = await savePassport({
    user_id: auth.user.id,
    passport_number,
    email: body.email || auth.user.email || "",
    display_name:
      body.display_name ||
      (auth.user.user_metadata?.full_name as string | undefined) ||
      "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Could not save passport" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ref: result.ref });
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  const ref = await getPassportRef(auth.user.id);
  return NextResponse.json({ ok: true, ref });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  await upsertTraveler({
    user_id: auth.user.id,
    email: auth.user.email || "",
    display_name:
      (auth.user.user_metadata?.full_name as string | undefined) || "",
    passport_ciphertext: null,
    passport_skipped: true,
  });

  const ref = await getPassportRef(auth.user.id);
  return NextResponse.json({ ok: true, ref });
}
