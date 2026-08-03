# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

AiDHD ("Splitrip") — a group-planning concierge built for the Prava Agentic Commerce Hackathon. One person starts a **night out** or a **multi-day trip**; the group drops budgets/prefs via web, WhatsApp, or iMessage; a multi-agent subnet reconciles responses into 2–3 costed packages; the group votes; the agent books end-to-end using **separate Prava mandates per cost category** (tickets/dining for outings; flights/hotel/dining/activities for trips).

Full product/architecture narrative and demo script: [README.md](README.md). Real failure modes hit during the build (WhatsApp session windows, serverless state loss, mode-flip bugs, empty-inventory edge cases, flight route defaults) are documented in [docs/CONTINGENCIES.md](docs/CONTINGENCIES.md) — read it before touching the collector, orchestrator, or WhatsApp webhook code, since it encodes non-obvious constraints that aren't visible from the code alone.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # type-check (no separate typecheck script)
```

There is no test suite / test runner configured in this repo.

Demo API loop (see [README.md](README.md) for the full script):

```bash
curl -X POST http://localhost:3000/api/demo/reset
curl -X POST http://localhost:3000/api/demo/seed-responses
curl -X POST http://localhost:3000/api/events/evt_demo_friday/reconcile
curl http://localhost:3000/api/health   # shows live/mock status per integration
```

Copy `.env.example` → `.env.local` to add real API keys. **The app never blocks on missing credentials** — every integration degrades to mocks/fixtures (see `src/lib/integrations/config.ts`, the `has*()` / `integrationStatus()` functions). `PRAVA_SECRET_KEY` is the one hard requirement for a real submission demo. Key sourcing/order is documented for teammates in [docs/API_KEYS.md](docs/API_KEYS.md) (no secrets in that file).

## Non-standard Next.js — read before writing App Router code

Per [AGENTS.md](AGENTS.md): this project's Next.js version (`^16.2.12`) has breaking changes vs. the Next.js in your training data. **Consult `node_modules/next/dist/docs/` before writing App Router code** (route handlers, layouts, params, etc.) rather than assuming familiar APIs still work the same way.

## Architecture

**Channels only collect; agents only plan.** This is the load-bearing invariant of the codebase — do not let WhatsApp/web/iMessage code paths do reconciliation, package building, or booking, and do not let agent code parse raw chat text.

```
Web chat / WhatsApp / iMessage   (src/lib/collector/*, src/app/api/channels/*)
            │  POST /api/events/:id/responses
            ▼
  runPlanningSubnet()             src/lib/agents/orchestrator.ts
     ├─ ticket/dining/flight/hotel search   src/lib/integrations/{ticketmaster,dining,flights,hotels}.ts
     └─ Senso vendor trust                   src/lib/integrations/senso.ts
            │
            ▼
   Package vote → per-category Prava mandates   src/lib/integrations/prava.ts, src/app/api/events/[id]/mandates
            │
            ▼
   Booking executor + confirmation fan-out       src/lib/agent/book.ts, src/lib/integrations/voice.ts
```

- **`src/lib/agents/orchestrator.ts`** is the entry point (`runPlanningSubnet`) that replaced an older monolithic `reconcile` flow. It branches on `event.type` (`"outing"` vs `"trip"`) into `runOutingAgents` / `runTripAgents`, both of which: extract tags/conflicts from responses, fan out to merchant search integrations in parallel, attach Senso trust scores per component (dropping/demoting packages below a trust floor), and build 2–3 `Package` tiers (Budget/Best match/Splurge) sorted by fit score. An optional LLM "polish" pass (`completeJson`) rewrites labels/rationales without touching numbers.
- **State is in-memory** (`src/lib/store.ts`), keyed off a `globalThis` singleton (`__aidhdStore`) so it survives HMR in dev but is **per-serverless-instance in production**. `src/lib/state-sync.ts` + `src/lib/durable-state.ts` debounce-flush a JSON snapshot (events/collectors/responses/packages/WhatsApp contacts) to an external JSONBlob (`AIDHD_STATE_BLOB_ID`) and rehydrate it on cold start — this is what keeps WhatsApp mid-flow state and group packages consistent across requests. If you add new mutable store fields, wire them into both the snapshot and hydrate paths or they'll silently vanish on redeploy/cold-start.
- **`src/lib/integrations/`** is the boundary to every external service (Gemini/OpenAI, Prava, Senso, Ticketmaster, Duffel flights+hotels, Linq, WhatsApp/Meta Graph, ElevenLabs, Twilio, Google Maps/Weather). Each module fails soft to a fixture/mock when its key is absent — `src/lib/integrations/config.ts` (`has*()` helpers) is the single source of truth for what's "live" vs "mock", surfaced at `GET /api/health`. Gemini is the preferred LLM, OpenAI is the fallback (`src/lib/integrations/llm.ts`).
- **Prava mandates are per cost category** (flight/hotel/ticket/dining — see `MandateCategory` in `src/lib/types.ts`), not one lump charge. If one category's booking fails, only that mandate gets re-requested (`src/lib/agent/book.ts`) — preserve this partial-failure/re-mandate behavior in any booking changes.
- **`src/lib/vault/`** stores traveler PII (passports) in Supabase, encrypted (`pii.ts` does AES-GCM via `AIDHD_VAULT_KEY`); the agent only ever sees a vault ref, never the ciphertext or plaintext — keep that boundary when touching traveler profile code.
- **`src/lib/reel/`** is a separate feature: decode a pasted Instagram/TikTok reel URL or transcript (Gemini) into a trip plan (city/dates/events/budget), independent of the group-collect flow.
- **`src/lib/integrations/nanda.ts`** exposes the app as an agent on the NANDA network (`GET /api/nanda/agent-card`, `POST /api/nanda/a2a`); `GET /api/agents` lists the internal agent subnet.

### Collector state machine

WhatsApp/iMessage/web collectors (`src/lib/collector/`) drive users through a fixed step order — `budget → origin → destination → availability → preferences → confirm → done` (see `stepRank` in `state-sync.ts`, which is also used to resolve merge conflicts between local and rehydrated collector sessions — higher rank always wins). Per [docs/CONTINGENCIES.md](docs/CONTINGENCIES.md): mode (`TRIP` vs `OUTING`) must be captured explicitly up front and never re-inferred from free-text vibe mid-flow; packages are generated **once per group** from all responses and broadcast identically to every member, never regenerated privately per user.

### Path aliases

`@/*` maps to `src/*` (see `tsconfig.json`).
