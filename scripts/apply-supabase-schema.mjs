/**
 * Apply AiDHD SQL schemas to a Supabase project via the Management API.
 * Needs SUPABASE_ACCESS_TOKEN (personal account) + project ref.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-supabase-schema.mjs
 *
 * Or set PROJECT_REF (default: from NEXT_PUBLIC_SUPABASE_URL).
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const ref =
  process.env.PROJECT_REF ||
  url.replace(/^https?:\/\//, "").split(".")[0];

if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)");
  process.exit(1);
}
if (!ref) {
  console.error("Set PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const files = [
  "supabase/profiles.sql",
  "supabase/traveler_profiles.sql",
  "supabase/groups.sql",
];

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }
  return text;
}

for (const f of files) {
  const sql = readFileSync(resolve(root, f), "utf8");
  console.log("Applying", f, "…");
  await runSql(sql);
  console.log("  ok");
}
console.log("Done — schemas on", ref);
