/**
 * User directory lookups (profiles table) for targeted invites and
 * SMS identity resolution.
 */

import { sb, supabaseConfigured } from "./store";

export type DirectoryProfile = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  phone: string | null;
};

function rowToProfile(row: Record<string, unknown>): DirectoryProfile {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    name: (row.name as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
  };
}

async function findBy(filter: string): Promise<DirectoryProfile | null> {
  if (!supabaseConfigured()) return null;
  const { ok, data } = await sb(`profiles?${filter}&limit=1`);
  if (ok && Array.isArray(data) && data[0]) {
    return rowToProfile(data[0] as Record<string, unknown>);
  }
  return null;
}

export async function findProfileByEmail(email: string) {
  return findBy(`email=eq.${encodeURIComponent(email.trim().toLowerCase())}`);
}

export async function findProfileByUsername(username: string) {
  return findBy(
    `username=eq.${encodeURIComponent(username.trim().toLowerCase().replace(/^@/, ""))}`,
  );
}

/** Match on the last 10 digits so +1 formatting differences don't matter. */
export async function findProfileByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const tail = digits.slice(-10);
  if (!supabaseConfigured()) return null;
  const { ok, data } = await sb(
    `profiles?phone=not.is.null&select=id,email,name,username,phone&limit=200`,
  );
  if (ok && Array.isArray(data)) {
    for (const row of data as Record<string, unknown>[]) {
      const p = String(row.phone ?? "").replace(/\D/g, "");
      if (p && p.slice(-10) === tail) return rowToProfile(row);
    }
  }
  return null;
}
