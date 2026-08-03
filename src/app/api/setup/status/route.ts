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
  const [profiles, travelers, groups, reactions, approvals, calendar, smsLinks, notifications] =
    await Promise.all([
      tableOk("profiles"),
      tableOk("traveler_profiles"),
      tableOk("groups"),
      tableOk("message_reactions"),
      tableOk("action_approvals"),
      tableOk("calendar_connections"),
      tableOk("sms_links"),
      tableOk("notifications"),
    ]);
  const v1 = profiles && travelers && groups;
  const v2 = reactions && approvals && calendar && smsLinks && notifications;
  const ok = v1 && v2;
  return NextResponse.json({
    ok,
    tables: {
      profiles,
      traveler_profiles: travelers,
      groups,
      message_reactions: reactions,
      action_approvals: approvals,
      calendar_connections: calendar,
      sms_links: smsLinks,
      notifications,
    },
    project: baseUrl(),
    message: ok
      ? "All tables present"
      : v1
        ? "Base schema present — run supabase/upgrade_v2.sql for chat features, approvals, calendar, and SMS"
        : "Run supabase/ALL.sql then supabase/upgrade_v2.sql in the SQL editor, then recheck",
  });
}
