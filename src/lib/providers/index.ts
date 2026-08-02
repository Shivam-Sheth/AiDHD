/**
 * Provider registry — the modular seam for every external capability.
 *
 * Each provider is a thin façade over the concrete integration in
 * `src/lib/integrations/*` (or a domain service in `src/lib/*`), so
 * capabilities can be swapped per environment without touching call sites.
 *
 * Commerce note: Shopify is intentionally NOT implemented here — another
 * team owns that module. Register it via `registerCommerceProvider()` when
 * it lands; everything routing through `getCommerceProvider()` will pick it
 * up automatically.
 */

import type { CommerceProvider } from "./commerce";
import { fixtureCommerceProvider } from "./commerce";

export const providers = {
  /** Supabase Auth (Google OAuth + email/password) — src/lib/supabase/client.ts, src/lib/groups/auth.ts */
  auth: () => import("@/lib/groups/auth"),
  /** Supabase data access (service role) — groups domain store */
  supabase: () => import("@/lib/groups/store"),
  /** Groups: membership, invites, roles */
  groups: () => import("@/lib/groups/store"),
  /** Chat: messages, reactions, reads, polls */
  chat: () => import("@/lib/groups/chat-extras"),
  /** OpenAI/Gemini agent brain */
  llm: () => import("@/lib/integrations/llm"),
  /** Agent tool execution (search/book/pay) */
  agentTools: () => import("@/lib/agent-tools/registry"),
  /** Approval-gated actions */
  approvals: () => import("@/lib/groups/approvals"),
  /** Travel: flights (Duffel) */
  flights: () => import("@/lib/integrations/flights"),
  /** Travel: hotels (Duffel Stays) */
  hotels: () => import("@/lib/integrations/hotels"),
  /** Restaurants / nightlife / movies (Google Places + fixtures) */
  dining: () => import("@/lib/integrations/dining"),
  /** Events & tickets (Ticketmaster) */
  events: () => import("@/lib/integrations/ticketmaster"),
  /** Voice calls (ElevenLabs outbound + user-led scripts) */
  calls: () => import("@/lib/agents/research-call"),
  /** SMS / iMessage (Linq) */
  sms: () => import("@/lib/integrations/linq"),
  /** SMS identity + concierge */
  smsConcierge: () => import("@/lib/collector/sms-concierge"),
  /** Google Calendar OAuth + events */
  calendar: () => import("@/lib/integrations/google-calendar"),
  /** Payments (Prava sessions / mandates / hosted checkout) */
  payments: () => import("@/lib/integrations/prava"),
  /** Notifications (persisted + realtime) */
  notifications: () => import("@/lib/notifications"),
  /** Realtime broadcast (Supabase) */
  realtime: () => import("@/lib/realtime/broadcast"),
} as const;

export type ProviderName = keyof typeof providers;

// ---------------------------------------------------------------------------
// Commerce (products from supported merchants)
// ---------------------------------------------------------------------------

let commerceProvider: CommerceProvider = fixtureCommerceProvider;

/** Swap in a real commerce provider (e.g. the Shopify module) at boot. */
export function registerCommerceProvider(provider: CommerceProvider) {
  commerceProvider = provider;
}

export function getCommerceProvider(): CommerceProvider {
  return commerceProvider;
}
