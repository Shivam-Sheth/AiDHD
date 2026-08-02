/**
 * Google Calendar provider — OAuth connect + event sync.
 *
 * Tokens are AES-GCM encrypted (AIDHD_VAULT_KEY) before they touch
 * calendar_connections; plaintext OAuth tokens are never stored or logged.
 * When Google OAuth isn't configured we fall back to a mock connection so
 * flows stay demoable.
 */

import { createHmac } from "crypto";
import { decryptSecret, encryptSecret, vaultConfigured } from "@/lib/vault/pii";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  /** ISO datetime or YYYY-MM-DD (all-day) */
  start?: string;
  /** ISO datetime or YYYY-MM-DD */
  end?: string;
  attendees?: string[]; // emails
  confirmation_number?: string;
  notes?: string;
  links?: string[];
  timezone?: string;
};

export type CalendarResult = {
  ok: boolean;
  summary: string;
  data?: { event_id?: string; html_link?: string; mode: "live" | "mock" };
};

type StoredTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
};

export function googleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function sb(path: string, init?: RequestInit) {
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

// In-memory fallback (demo / local dev without Supabase)
const g = globalThis as unknown as {
  __aidhdCalendar?: Map<string, { tokens: StoredTokens; email: string }>;
};
function mem() {
  if (!g.__aidhdCalendar) g.__aidhdCalendar = new Map();
  return g.__aidhdCalendar;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

/** Signed state so the callback can't be forged to another user's row. */
export function signOAuthState(userId: string): string {
  const secret = process.env.AIDHD_VAULT_KEY || "dev-secret";
  const payload = Buffer.from(
    JSON.stringify({ u: userId, t: Date.now() }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): string | null {
  const secret = process.env.AIDHD_VAULT_KEY || "dev-secret";
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { u: string; t: number };
    if (Date.now() - parsed.t > 15 * 60_000) return null; // 15-min window
    return parsed.u;
  } catch {
    return null;
  }
}

export function buildOAuthUrl(userId: string, origin: string): string | null {
  if (!googleCalendarConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: `${origin}/api/calendar/oauth/callback`,
    response_type: "code",
    scope: `${CALENDAR_SCOPE} email`,
    access_type: "offline",
    prompt: "consent",
    state: signOAuthState(userId),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeOAuthCode(input: {
  code: string;
  origin: string;
}): Promise<{ tokens: StoredTokens; email: string } | null> {
  if (!googleCalendarConfigured()) return null;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${input.origin}/api/calendar/oauth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  let email = "";
  if (data.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(data.id_token.split(".")[1]!, "base64url").toString("utf8"),
      ) as { email?: string };
      email = payload.email || "";
    } catch {
      // best-effort
    }
  }
  return {
    tokens: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    },
    email,
  };
}

export async function saveCalendarConnection(input: {
  userId: string;
  tokens: StoredTokens;
  email: string;
}): Promise<boolean> {
  mem().set(input.userId, { tokens: input.tokens, email: input.email });

  if (!supabaseConfigured()) return true;
  const ciphertext = vaultConfigured()
    ? encryptSecret(JSON.stringify(input.tokens))
    : Buffer.from(JSON.stringify(input.tokens)).toString("base64url");
  const { ok } = await sb("calendar_connections?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: input.userId,
      provider: "google",
      account_email: input.email,
      tokens_ciphertext: ciphertext,
      scope: CALENDAR_SCOPE,
      expiry: new Date(input.tokens.expires_at).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return ok;
}

export async function getCalendarConnection(
  userId: string,
): Promise<{ email: string; connected: boolean }> {
  const cached = mem().get(userId);
  if (cached) return { email: cached.email, connected: true };
  if (supabaseConfigured()) {
    const { ok, data } = await sb(
      `calendar_connections?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    if (ok && Array.isArray(data) && data[0]) {
      const row = data[0] as Record<string, unknown>;
      return { email: String(row.account_email ?? ""), connected: true };
    }
  }
  return { email: "", connected: false };
}

export async function disconnectCalendar(userId: string): Promise<void> {
  mem().delete(userId);
  if (supabaseConfigured()) {
    await sb(`calendar_connections?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  }
}

async function loadTokens(userId: string): Promise<StoredTokens | null> {
  const cached = mem().get(userId);
  if (cached) return cached.tokens;
  if (!supabaseConfigured()) return null;
  const { ok, data } = await sb(
    `calendar_connections?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!ok || !Array.isArray(data) || !data[0]) return null;
  const row = data[0] as Record<string, unknown>;
  const ciphertext = String(row.tokens_ciphertext ?? "");
  const plaintext = vaultConfigured()
    ? decryptSecret(ciphertext)
    : Buffer.from(ciphertext, "base64url").toString("utf8");
  if (!plaintext) return null;
  try {
    return JSON.parse(plaintext) as StoredTokens;
  } catch {
    return null;
  }
}

async function freshAccessToken(userId: string): Promise<string | null> {
  const tokens = await loadTokens(userId);
  if (!tokens) return null;
  if (tokens.expires_at > Date.now() + 60_000) return tokens.access_token;
  if (!tokens.refresh_token || !googleCalendarConfigured()) {
    return tokens.access_token;
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return tokens.access_token;
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const next: StoredTokens = {
    access_token: data.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  const conn = await getCalendarConnection(userId);
  await saveCalendarConnection({ userId, tokens: next, email: conn.email });
  return next.access_token;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function toGoogleTime(value: string | undefined, timezone?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value };
  return { dateTime: value, timeZone: timezone || "America/Chicago" };
}

/**
 * Create a calendar event for a connected user. Callers must have gone
 * through the approval flow first — this function does no permission checks.
 */
export async function createCalendarEvent(
  userId: string,
  event: CalendarEventInput,
): Promise<CalendarResult> {
  if (!userId) return { ok: false, summary: "No user for calendar event." };

  const descriptionParts = [
    event.description,
    event.confirmation_number
      ? `Confirmation: ${event.confirmation_number}`
      : null,
    event.notes,
    event.links?.length ? `Links:\n${event.links.join("\n")}` : null,
  ].filter(Boolean);

  const accessToken = await freshAccessToken(userId);
  if (!accessToken) {
    const connected = (await getCalendarConnection(userId)).connected;
    if (!connected) {
      return {
        ok: false,
        summary:
          "Google Calendar isn't connected — connect it from Account → Google Calendar first.",
      };
    }
    // Connection exists but tokens unusable (mock/demo mode)
    return {
      ok: true,
      summary: `"${event.title}" added (demo mode — connect Google OAuth for live sync).`,
      data: { mode: "mock" },
    };
  }

  const start =
    toGoogleTime(event.start, event.timezone) ??
    toGoogleTime(new Date(Date.now() + 3600_000).toISOString(), event.timezone);
  const end =
    toGoogleTime(event.end, event.timezone) ??
    (start && "dateTime" in start!
      ? {
          dateTime: new Date(
            new Date(start.dateTime!).getTime() + 3600_000,
          ).toISOString(),
          timeZone: start.timeZone,
        }
      : start);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: descriptionParts.join("\n\n") || undefined,
        location: event.location || undefined,
        start,
        end,
        attendees: event.attendees?.length
          ? event.attendees.map((email) => ({ email }))
          : undefined,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      summary: `Google Calendar error (${res.status}): ${body.slice(0, 160)}`,
    };
  }
  const data = (await res.json()) as { id?: string; htmlLink?: string };
  return {
    ok: true,
    summary: `"${event.title}" added to Google Calendar${
      event.start ? ` on ${event.start.slice(0, 10)}` : ""
    }.`,
    data: { event_id: data.id, html_link: data.htmlLink, mode: "live" },
  };
}
