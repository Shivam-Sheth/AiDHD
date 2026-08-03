import { createClient } from "@supabase/supabase-js";
import type { GroupSessionUser } from "./types";

/**
 * Resolve the caller for group APIs.
 * Prefer Supabase JWT; fall back to demo headers (hackathon email login).
 */
export async function resolveGroupUser(
  req: Request,
): Promise<GroupSessionUser | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "").trim();

  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) {
      const name =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Member";
      return {
        id: user.id,
        email: user.email || "",
        name,
      };
    }
  }

  const id = req.headers.get("x-aidhd-user-id")?.trim();
  const name = req.headers.get("x-aidhd-user-name")?.trim();
  const email = req.headers.get("x-aidhd-user-email")?.trim() || "";
  if (id && name) {
    return { id, email, name };
  }

  return null;
}
