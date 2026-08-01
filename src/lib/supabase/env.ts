export function supabaseUrl(): string | null {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    null
  );
}

export function supabaseAnonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY?.trim() || null;
}

export function supabaseServiceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

export function isSupabaseDbConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}
