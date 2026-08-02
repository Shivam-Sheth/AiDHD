/** Browser session for group APIs (Supabase JWT or demo local user). */

const STORAGE_KEY = "aidhd_group_user";

export type LocalGroupUser = {
  id: string;
  name: string;
  email: string;
};

export function readLocalGroupUser(): LocalGroupUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalGroupUser;
    if (parsed?.id && parsed?.name) return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function writeLocalGroupUser(user: LocalGroupUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export async function groupAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { supabase } = await import("@/lib/supabase/client");
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        return headers;
      }
    }
  } catch {
    // fall through
  }

  const local = readLocalGroupUser();
  if (local) {
    headers["x-aidhd-user-id"] = local.id;
    headers["x-aidhd-user-name"] = local.name;
    headers["x-aidhd-user-email"] = local.email || "";
  }
  return headers;
}
