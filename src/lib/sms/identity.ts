/**
 * SMS identity links — securely tie a phone number to an app user.
 *
 * Flow: user enters their phone in the app → we mint a 6-digit code →
 * they text "LINK <code>" to the Prava Linq number → verified. Only then
 * does the SMS concierge act on their behalf.
 */

import { randomInt } from "crypto";
import { sb, supabaseConfigured } from "@/lib/groups/store";

export type SmsSession = {
  pending_approval_id?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  last_options?: Array<Record<string, unknown>>;
  updated_at?: string;
};

export type SmsLink = {
  phone: string;
  user_id: string;
  user_name: string;
  verify_code?: string | null;
  verified: boolean;
  default_group_id?: string | null;
  session: SmsSession;
};

export function normalizeSmsPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

const g = globalThis as unknown as { __aidhdSmsLinks?: Map<string, SmsLink> };
function mem() {
  if (!g.__aidhdSmsLinks) g.__aidhdSmsLinks = new Map();
  return g.__aidhdSmsLinks;
}

function rowToLink(row: Record<string, unknown>): SmsLink {
  return {
    phone: String(row.phone),
    user_id: String(row.user_id),
    user_name: String(row.user_name ?? ""),
    verify_code: (row.verify_code as string | null) ?? null,
    verified: Boolean(row.verified),
    default_group_id: (row.default_group_id as string | null) ?? null,
    session:
      row.session && typeof row.session === "object"
        ? (row.session as SmsSession)
        : {},
  };
}

async function persist(link: SmsLink) {
  mem().set(link.phone, link);
  if (!supabaseConfigured()) return;
  const res = await sb("sms_links?on_conflict=phone", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      phone: link.phone,
      user_id: link.user_id,
      user_name: link.user_name,
      verify_code: link.verify_code,
      verified: link.verified,
      default_group_id: link.default_group_id,
      session: link.session,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    // Schema drift (no session column yet) — retry without it.
    await sb("sms_links?on_conflict=phone", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        phone: link.phone,
        user_id: link.user_id,
        user_name: link.user_name,
        verify_code: link.verify_code,
        verified: link.verified,
        updated_at: new Date().toISOString(),
      }),
    });
  }
}

export async function getSmsLinkByPhone(
  phone: string,
): Promise<SmsLink | null> {
  const key = normalizeSmsPhone(phone);
  if (!key) return null;
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `sms_links?phone=eq.${encodeURIComponent(key)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      const link = rowToLink(data[0] as Record<string, unknown>);
      mem().set(key, link);
      return link;
    }
  }
  return mem().get(key) ?? null;
}

export async function getSmsLinkByUser(
  userId: string,
): Promise<SmsLink | null> {
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `sms_links?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      return rowToLink(data[0] as Record<string, unknown>);
    }
  }
  for (const link of mem().values()) {
    if (link.user_id === userId) return link;
  }
  return null;
}

/** Start linking: mint a code the user must text back. */
export async function startSmsLink(input: {
  phone: string;
  userId: string;
  userName: string;
}): Promise<{ code: string; phone: string }> {
  const phone = normalizeSmsPhone(input.phone);
  const code = String(randomInt(100000, 999999));
  const existing = await getSmsLinkByPhone(phone);
  const link: SmsLink = {
    phone,
    user_id: input.userId,
    user_name: input.userName,
    verify_code: code,
    verified: existing?.user_id === input.userId ? existing.verified : false,
    default_group_id: existing?.default_group_id ?? null,
    session: {},
  };
  await persist(link);
  return { code, phone };
}

/** Verify from an inbound "LINK 123456" text. */
export async function verifySmsLink(
  phone: string,
  code: string,
): Promise<SmsLink | null> {
  const link = await getSmsLinkByPhone(phone);
  if (!link || !link.verify_code) return null;
  if (link.verify_code !== code.trim()) return null;
  link.verified = true;
  link.verify_code = null;
  await persist(link);
  return link;
}

export async function unlinkSms(userId: string): Promise<void> {
  const link = await getSmsLinkByUser(userId);
  if (!link) return;
  mem().delete(link.phone);
  if (supabaseConfigured()) {
    await sb(`sms_links?phone=eq.${encodeURIComponent(link.phone)}`, {
      method: "DELETE",
    });
  }
}

export async function saveSmsSession(
  phone: string,
  session: SmsSession,
): Promise<void> {
  const link = await getSmsLinkByPhone(phone);
  if (!link) return;
  link.session = { ...session, updated_at: new Date().toISOString() };
  await persist(link);
}

export async function setDefaultGroup(
  userId: string,
  groupId: string | null,
): Promise<void> {
  const link = await getSmsLinkByUser(userId);
  if (!link) return;
  link.default_group_id = groupId;
  await persist(link);
}
