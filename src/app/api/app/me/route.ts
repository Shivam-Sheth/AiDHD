import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";
import { getPassportRef, getTraveler, upsertTraveler } from "@/lib/vault/traveler-store";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  const profile = await repo.ensureProfile(auth.admin, {
    id: auth.user.id,
    email: auth.user.email,
    name:
      (auth.user.user_metadata?.full_name as string | undefined) ||
      (auth.user.user_metadata?.name as string | undefined) ||
      null,
    phone: (auth.user.user_metadata?.phone as string | undefined) || null,
  });

  const traveler = await getTraveler(auth.user.id);
  const passport = await getPassportRef(auth.user.id);

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
    },
    profile,
    traveler: traveler
      ? {
          display_name: traveler.display_name,
          phone: traveler.phone,
          email: traveler.email,
          prava_card_last4: traveler.prava_card_last4,
          prava_card_brand: traveler.prava_card_brand,
          prava_mandate_status: traveler.prava_mandate_status,
        }
      : null,
    passport,
    storage: auth.admin ? "supabase" : "memory",
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    handle?: string;
    phone?: string;
  };

  const profile = await repo.ensureProfile(auth.admin, {
    id: auth.user.id,
    email: auth.user.email,
    name: body.name,
    handle: body.handle,
    phone: body.phone,
  });

  await upsertTraveler({
    user_id: auth.user.id,
    email: profile.email,
    display_name: profile.name || "",
    phone: body.phone ?? profile.phone,
  });

  return NextResponse.json({ profile });
}
