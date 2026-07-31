/**
 * Supabase traveler profiles — server-only via service role.
 * Agent never reads passport_ciphertext; only vault refs.
 */

import {
  decryptSecret,
  encryptSecret,
  passportVaultRef,
  vaultConfigured,
  type VaultRef,
} from "./pii";

export type TravelerProfile = {
  user_id: string;
  email: string;
  display_name: string;
  phone?: string | null;
  passport_ciphertext?: string | null;
  passport_skipped?: boolean;
  prava_mandate_id?: string | null;
  prava_mandate_status?: string | null;
  prava_card_last4?: string | null;
  prava_card_brand?: string | null;
};

function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function sb(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, data, status: res.status };
}

const memory = new Map<string, TravelerProfile>();

export async function upsertTraveler(
  profile: Partial<TravelerProfile> & { user_id: string },
): Promise<{ ok: boolean; error?: string }> {
  const row = {
    ...profile,
    updated_at: new Date().toISOString(),
  };

  if (!supabaseConfigured()) {
    const prev = memory.get(profile.user_id) || {
      user_id: profile.user_id,
      email: "",
      display_name: "",
    };
    memory.set(profile.user_id, { ...prev, ...row });
    return { ok: true };
  }

  const { ok, data, status } = await sb("traveler_profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (!ok) {
    return {
      ok: false,
      error: `Supabase ${status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    };
  }
  return { ok: true };
}

export async function getTraveler(
  user_id: string,
): Promise<TravelerProfile | null> {
  if (!supabaseConfigured()) {
    return memory.get(user_id) || null;
  }
  const { ok, data } = await sb(
    `traveler_profiles?user_id=eq.${encodeURIComponent(user_id)}&select=*`,
  );
  if (!ok || !Array.isArray(data) || !data[0]) return null;
  return data[0] as TravelerProfile;
}

/** Save passport — stores ciphertext only. */
export async function savePassport(input: {
  user_id: string;
  passport_number: string;
  email?: string;
  display_name?: string;
}): Promise<{ ok: boolean; ref?: VaultRef; error?: string }> {
  if (!vaultConfigured()) {
    return { ok: false, error: "AIDHD_VAULT_KEY not configured" };
  }
  const cipher = encryptSecret(input.passport_number.trim());
  if (!cipher) return { ok: false, error: "Encrypt failed" };

  const saved = await upsertTraveler({
    user_id: input.user_id,
    email: input.email || "",
    display_name: input.display_name || "",
    passport_ciphertext: cipher,
    passport_skipped: false,
  });
  if (!saved.ok) return saved;

  return {
    ok: true,
    ref: passportVaultRef(input.user_id, true),
  };
}

/** Server-side only — for Duffel booking. Never expose to LLM. */
export async function loadPassportPlaintext(
  user_id: string,
): Promise<string | null> {
  const t = await getTraveler(user_id);
  if (!t?.passport_ciphertext) return null;
  return decryptSecret(t.passport_ciphertext);
}

export async function getPassportRef(user_id: string): Promise<VaultRef> {
  const t = await getTraveler(user_id);
  return passportVaultRef(user_id, Boolean(t?.passport_ciphertext));
}
