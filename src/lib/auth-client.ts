"use client";

import { supabase } from "@/lib/supabase/client";

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Sign in required");
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || res.statusText || "Request failed",
    );
  }
  return data as T;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
