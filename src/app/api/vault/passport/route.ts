import { NextResponse } from "next/server";
import {
  getPassportRef,
  savePassport,
} from "@/lib/vault/traveler-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Store passport for flight booking only.
 * remember:true → AES vault in traveler_profiles
 * remember:false → RAM one-time stash (30m), never persisted
 */
export async function POST(req: Request) {
  let body: {
    user_id?: string;
    passport_number?: string;
    email?: string;
    display_name?: string;
    remember?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user_id = body.user_id?.trim();
  const passport_number = body.passport_number?.trim();
  if (!user_id || !passport_number) {
    return NextResponse.json(
      { error: "user_id and passport_number required" },
      { status: 400 },
    );
  }

  const saved = await savePassport({
    user_id,
    passport_number,
    email: body.email,
    display_name: body.display_name,
    remember: body.remember !== false,
  });

  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    remembered: saved.remembered !== false,
    ref: saved.ref,
    note:
      saved.remembered === false
        ? "One-time passport held in memory for this booking only."
        : "Ciphertext stored. Agent tools only see ref.present — never the number.",
  });
}

export async function GET(req: Request) {
  const user_id = new URL(req.url).searchParams.get("user_id");
  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const ref = await getPassportRef(user_id);
  return NextResponse.json({ ok: true, ref });
}
