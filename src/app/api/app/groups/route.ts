import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const db = auth.admin;
  await repo.ensureProfile(db, {
    id: auth.user.id,
    email: auth.user.email,
  });
  const groups = await repo.listGroups(db, auth.user.id);
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const db = auth.admin;

  await repo.ensureProfile(db, {
    id: auth.user.id,
    email: auth.user.email,
    name:
      (auth.user.user_metadata?.full_name as string | undefined) ||
      (auth.user.user_metadata?.name as string | undefined) ||
      null,
  });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    destination?: string;
    friend_ids?: string[];
    source_reel_url?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  try {
    const result = await repo.createGroup(db, {
      name: body.name,
      destination: body.destination,
      created_by: auth.user.id,
      member_ids: body.friend_ids || [],
      source_reel_url: body.source_reel_url,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create group" },
      { status: 400 },
    );
  }
}
