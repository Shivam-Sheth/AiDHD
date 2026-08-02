import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  return raw.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

async function tableOk(table: string): Promise<boolean> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = baseUrl();
  if (!key || !base) return false;
  const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.ok;
}

export async function GET() {
  const profiles = await tableOk("profiles");
  const travelers = await tableOk("traveler_profiles");
  const groups = await tableOk("groups");
  const ok = profiles && travelers && groups;
  return NextResponse.json({
    ok,
    tables: { profiles, traveler_profiles: travelers, groups },
    project: baseUrl(),
    message: ok
      ? "All tables present"
      : "Run supabase/ALL.sql in the SQL editor, then recheck",
  });
}
