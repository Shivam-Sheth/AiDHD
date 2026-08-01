import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  isSupabaseAuthConfigured,
  isSupabaseDbConfigured,
  supabaseAnonKey,
  supabaseServiceKey,
  supabaseUrl,
} from "./env";

export { isSupabaseAuthConfigured, isSupabaseDbConfigured } from "./env";

export type AuthContext = {
  user: User;
  token: string;
  /** User-JWT scoped client (RLS applies). */
  userClient: SupabaseClient;
  /** Service-role client when available (bypasses RLS). */
  admin: SupabaseClient | null;
};

export function createAnonClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(token: string): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function bearerFrom(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  if (!isSupabaseAuthConfigured()) {
    return Response.json(
      {
        error:
          "Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      },
      { status: 503 },
    );
  }

  const token = bearerFrom(req);
  if (!token) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const userClient = createUserClient(token);
  if (!userClient) {
    return Response.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return Response.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  return {
    user,
    token,
    userClient,
    admin: isSupabaseDbConfigured() ? createServiceClient() : null,
  };
}

export function isAuthContext(value: AuthContext | Response): value is AuthContext {
  return Boolean(value && typeof value === "object" && "user" in value);
}

/** Prefer admin (service role) for reliable server writes; fall back to user JWT client. */
export function dbClient(auth: AuthContext): SupabaseClient {
  return auth.admin ?? auth.userClient;
}
