/**
 * Stable absolute base URL for building links this app sends out (Prava
 * merchant_url, WhatsApp/Linq message text, the Prava pay_url fallback,
 * ElevenLabs tool webhook base, etc).
 *
 * Never hardcode a specific deployment's URL for this — Vercel mints a new
 * one on every commit (e.g. aidhd-<hash>-<team>.vercel.app). Use
 * VERCEL_PROJECT_PRODUCTION_URL instead: Vercel sets it automatically and it
 * always points at the current production domain (your custom domain if one
 * is attached, otherwise the stable <project>.vercel.app alias) regardless
 * of which specific deployment is live. VERCEL_URL is NOT what you want
 * here — that one *is* the per-deployment URL that changes every commit.
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
