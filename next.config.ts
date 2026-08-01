import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SUPABASE_URL / SUPABASE_ANON_KEY aren't NEXT_PUBLIC_-prefixed, so they're
  // server-only by default. The anon key is safe to ship to the browser (it's
  // gated by RLS) and the Supabase Auth sign-in flow runs client-side, so
  // inline both into the JS bundle at build time.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  },
};

export default nextConfig;
