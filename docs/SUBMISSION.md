# AiDHD — Devfolio submission notes

## One-liner
AiDHD turns group chat chaos into a paid plan: iMessage/WhatsApp prefs → live inventory + Senso trust → Prava Collect mandate → confirmation.

## Judge path (3 minutes)
1. Open https://aidhd-omega.vercel.app → **Judge demo · Live Concierge**
2. Start voice or type: “Round-trip Chicago to New York Aug 11–15”
3. Confirm Live · Duffel cards + optional Google Flights link
4. “Pay $X for [airline]” → Prava Collect iframe
5. Click **I approved Collect — complete booking** → receipt (session → mandate → token ref)
6. Optional Linq: text the Linq number first → prefs → Prava link follow-up → reply **PAID**

## Tracks we claim
| Track | How it’s material |
|-------|-------------------|
| **Prava** | Live sandbox session + Collect; complete endpoint binds mandate + scoped token receipt |
| **Linq** | Core inbound-first iMessage prefs → search → Prava link → PAID confirmation in-thread |
| **Senso** | Package “Best match” picks highest-trust merchants; fit_score weighted by trust; Linq sends trust check |
| **Visa Intelligent Commerce** | Via Prava (official partner path) |

## Pre-existing vs built in-window (disclose)
**Before / early scaffold:** Next.js app shell, demo reconcile UI, WhatsApp collector, Duffel/Ticketmaster adapters, basic Prava session create, fixtures.

**Hackathon build (material):** `/agent` ElevenLabs client tools + cards, hotel workflow cleared, Linq Partner API v3 + webhook bot with search/pay, Senso-ranked packages, Prava `/api/prava/complete` receipt UX, passport vault scaffolding, Google Flights deep links, judge landing CTAs.

## Honest limits
- Google Flights has no public API — Duffel is live inventory; Maps deep link is secondary.
- Passkey Collect is live in sandbox; network token invoke is represented as a scoped `token_ref` bound to the live `session_id` (never log PAN/CVV).
- Linq sandbox: inbound-first; no links on first outbound.

## Repo / demo
- Live: https://aidhd-omega.vercel.app/agent
- Sync agent: `POST /api/agent/sync`
- Linq subscribe: `POST /api/channels/linq/subscribe`
