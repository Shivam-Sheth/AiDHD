import { NextResponse } from "next/server";
import * as repo from "@/lib/db/repo";
import { isAuthContext, requireAuth } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;
  const q = new URL(req.url).searchParams.get("q") || "";
  const users = await repo.searchProfiles(auth.admin, q, auth.user.id);
  return NextResponse.json({ users });
}
