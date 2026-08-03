# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

AiDHD — a group-outing/trip planning agent built for a hackathon (Prava's Agentic Commerce Hackathon). One person starts an event, group members drop budgets/prefs via web / WhatsApp / iMessage(Linq), a multi-agent subnet reconciles responses into 2–3 costed packages, the group votes, and the agent books end-to-end using **separate Prava payment mandates per cost category** (tickets/dining for outings; flights/hotel/dining/activities for trips).

Read `README.md` for the product pitch/demo script and `docs/HACKATHON_WIN.md` + `docs/CONTINGENCIES.md` for hard-won operational lessons (WhatsApp/Meta quirks, Linq sandbox rules, serverless state pitfalls, consensus logic) — these documents encode real bugs hit during development and should inform any changes to the collector/channel/consensus code.

## Commands

```bash
npm install
npm run dev      # next dev — http://localhost:3000
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

No test suite is configured in this repo. Verify changes via `npm run lint`, `npm run build`, and manual exercise of the relevant API route (see `docs/API_KEYS.md` for a curl-based smoke test and `GET /api/health` for live/mock integration status).

```bash
npm run whatsapp:keepalive   # scripts/whatsapp-keepalive.sh — keeps local webhook warm during WhatsApp demos (needs a cloudflared tunnel)
```

## Architecture

```
Web chat / WhatsApp / iMessage(Linq)   ← channels COLLECT ONLY (budget, dates, vibe)
            │  POST /api/events/:id/responses
            ▼
   Orchestrator (src/lib/agents/orchestrator.ts)
     ├─ ticket search (Ticketmaster or fixtures)
     ├─ dining / flights / hotels search (Duffel or fixtures)
     └─ Senso vendor trust lookup per component
            │
            ▼
   Package vote → per-category Prava mandates → booking executor → confirmation fan-out
```

**Hard rule baked into the codebase:** channels (WhatsApp bot, web collector, Linq/iMessage bot) only *collect* structured responses — they must never generate packages or book anything themselves. All package generation happens once per event in the orchestrator and is broadcast identically to the whole group (never regenerated per-user). See `docs/CONTINGENCIES.md` §3 before changing consensus/collector logic.

### Layer map (`src/lib/`)

- `agents/orchestrator.ts` — the actual planning brain. `runPlanningSubnet()` branches on `event.type` (`outing` vs `trip`) into `runOutingAgents` / `runTripAgents`, which fan out to merchant search + Senso trust in parallel, build 2–3 `Package`s (Budget/Best-match/Splurge), and optionally polish labels via `integrations/llm.ts`.
- `agent-tools/registry.ts` — the *other* agent surface: real-time concierge tool-calling (used by the ElevenLabs voice agent at `/agent` and the text chat loop). `executeAgentTool()` dispatches `search_flights` / `search_hotels` / `search_tickets` / `search_dining` / `search_clubs` / `search_movies` / `lookup_vendor` / `get_weather` / `create_payment`. `CONCIERGE_SYSTEM_PROMPT` and `elevenLabsToolDefinitions()` define the voice agent's behavior — push changes live with `POST /api/agent/sync`.
- `collector/` — per-channel conversational state machines (`web-chat.ts`, `whatsapp-bot.ts`, `linq-bot.ts`) that walk a user through mode → budget → (origin/destination) → dates → vibe → confirm. Uses `collector/gemini-parse.ts` for NLU with regex fallback — never hard-match exact strings for free-text input.
- `integrations/` — one file per external vendor (`prava.ts`, `senso.ts`, `ticketmaster.ts`, `flights.ts`/`hotels.ts` via Duffel, `whatsapp.ts`, `linq.ts`, `voice.ts` via ElevenLabs, `weather.ts`, `nanda.ts`). **Every integration must degrade to a realistic mock/fixture when its API key is absent** — the app must never crash or block on missing credentials. Gate live behavior through `integrations/config.ts` (`hasPrava()`, `hasSenso()`, `hasDuffel()`, etc.) rather than checking `process.env` directly.
- `store.ts` — in-memory demo store (`Map`-backed, kept on `globalThis` to survive HMR). Every mutating call schedules a durable-state flush.
- `durable-state.ts` / `state-sync.ts` — cross-instance persistence for Vercel serverless (in-memory `Map`s reset on cold start, which breaks mid-conversation WhatsApp/Linq flows). Backed by a JSONBlob (`AIDHD_STATE_BLOB_ID`/`AIDHD_STATE_BLOB_URL`); hydrates contacts/collectors/responses/packages/Linq sessions on each webhook call. If you add new mutable state that channels depend on across requests, wire it into `DurablePayload`.
- `vault/pii.ts` + `vault/traveler-store.ts` — AES-256-GCM encryption for passport/traveler PII (Supabase-backed). **Agent tools and LLM prompts must only ever see a vault ref, never plaintext PII or full card numbers/CVV** — this is enforced in `CONCIERGE_SYSTEM_PROMPT` and must be preserved in any new tool.
- `types.ts` — canonical domain types (`Event`, `Response`, `Package`, `Mandate`, `Booking`, `CollectorSession`). `types-client.ts` is the client-safe subset.
- `demo-users.ts` — hardcoded 3-person demo group (no auth on the collect/event flow).

### Routes (`src/app/api/`)

- `events/[id]/responses`, `events/[id]/reconcile`, `events/[id]/vote`, `events/[id]/mandates`, `events/[id]/book` — the core outing/trip event lifecycle.
- `agent/*` — voice/text concierge: `chat`, `signed-url` (ElevenLabs), `sync` (push tool defs/prompt to the live agent), `tools`, `ui-feed`.
- `channels/whatsapp/*`, `channels/linq/*`, `channels/imessage/*` — channel webhooks/adapters. WhatsApp and Linq both have strict sandbox rules (template-first messaging, inbound-first, 24h session windows) — see `docs/CONTINGENCIES.md` §1 and `docs/HACKATHON_WIN.md` "Linq rules" before editing.
- `demo/reset`, `demo/seed-responses` — reset/seed the in-memory store for demos.
- `prava/complete` — binds a Prava mandate to a booking and returns a receipt.
- `nanda/agent-card`, `nanda/a2a` — Project NANDA AgentFacts registration + A2A trust ping.
- `health` — reports live/mock status per integration (`integrationStatus()` in `integrations/config.ts`).

### Payments (Prava) — non-negotiable ordering

Collect → generate shared packages → group vote → **request one Prava mandate per cost category** (ticket/dining or flight/hotel/dining) → approve mandates → book. On partial booking failure, re-mandate **only** the failed category, never the whole package. Never store PAN/CVV — only `prava_mandate_id` / scoped `token_ref`.

## Path alias

`@/*` → `./src/*` (see `tsconfig.json`).

## Env / secrets

Copy `.env.example` → `.env.local`; the app is designed to never block on missing keys (mocks/fixtures fill the gap — see `integrations/config.ts`). Full key-by-key setup guide (non-secret): `docs/API_KEYS.md`. Never commit `.env.local` or real secrets.
