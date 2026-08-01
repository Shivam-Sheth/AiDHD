# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

AiDHD ("Splitrip") — a group night-out/trip concierge built for a hackathon (Prava Agentic Commerce
Hackathon, Jul 31–Aug 2 2026). One organizer starts an **outing** or a **trip**, invitees drop budgets/prefs
via web, WhatsApp, or iMessage, a multi-agent subnet reconciles responses into 2–3 costed packages, the
group votes, and the app books end-to-end using **separate Prava payment mandates per cost category**
(tickets/dining for outings; flights/hotel/dining/activities for trips).

Full product framing, demo script, and track alignment: [README.md](./README.md).

## Commands

```bash
npm install
npm run dev      # next dev, http://localhost:3000
npm run build
npm run start
npm run lint      # eslint (flat config in eslint.config.mjs)
npm run whatsapp:keepalive   # pings /api/health + WhatsApp webhook every 20s to keep a local tunnel warm
```

There is no test suite in this repo currently.

### Demo/manual API flow

```bash
curl -X POST http://localhost:3000/api/demo/reset
curl -X POST http://localhost:3000/api/demo/seed-responses
curl -X POST http://localhost:3000/api/events/evt_demo_friday/responses -d '{...}'   # same schema for all channels
curl -X POST http://localhost:3000/api/events/evt_demo_friday/reconcile
curl http://localhost:3000/api/health   # shows live vs mock/fixture status per integration
```

## Architecture

**Strict separation: channels collect, the orchestrator does everything else.** WhatsApp, web chat, and
iMessage (`src/lib/collector/*`) only gather `Response` objects (budget, dates, vibe, origin/destination for
trips) — they never search inventory or book. All actual work happens in the agent subnet:

```
Channels (collect only) → POST /api/events/:id/responses
        → Orchestrator (src/lib/agents/orchestrator.ts): runPlanningSubnet(event, responses)
            outing → tickets + dining search, trip → flights + hotels (+ destination tickets if vibe implies an activity)
            → Senso vendor trust attached to every component
            → optional LLM polish pass on package labels/rationale
        → 2–3 Package objects, voted on → per-category Prava mandates (src/lib/integrations/prava.ts)
        → booking executor (src/lib/agent/book.ts) + confirmation fan-out (voice/WhatsApp)
```

Do not add search/booking logic to anything under `src/lib/collector/`; it belongs in
`src/lib/agents/orchestrator.ts` or `src/lib/integrations/*`. This separation broke demo consensus before
(see `docs/CONTINGENCIES.md`) when collector-side code started making independent per-user decisions.

**Group consensus, not per-user plans.** Packages are generated once per event from *all* responses and the
same list is broadcast to every member — never regenerate a private package list after a single user's `YES`.
Date/budget conflicts resolve via majority window / group middle-ground with explicit re-prompts
(`EXCEPTION`, `RAISE`/`KEEP`/`BUDGET N`), not silent per-user branching.

**Everything degrades to mocks/fixtures.** `src/lib/integrations/config.ts` (`hasGemini`, `hasPrava`,
`hasSenso`, `hasDuffel`, etc.) gates each integration; the app must never crash on a missing key — it falls
back to fixture data (`src/lib/merchants/fixtures.ts`) or mock responses. `GET /api/health` reports live vs
mock/fixture per integration. When adding a new integration, follow this pattern: a `has<X>()` check in
`config.ts`, a real call behind it, and a fixture/mock fallback in front of it.

- LLM: Gemini preferred (`GEMINI_API_KEY`), OpenAI is the fallback (`src/lib/integrations/llm.ts`,
  `completeJson`). Both are optional — collector NLU and package polish both work without either.
- Payments: Prava is the one **hard requirement** for hackathon submission (`PRAVA_SECRET_KEY`) — separate
  mandate per `MandateCategory`, and if one leg's booking fails, only that category gets re-mandated.
- Flights/hotels: Duffel only (`DUFFEL_API_KEY`, covers both flights and Duffel Stays). Amadeus is dead —
  `hasAmadeus()` always returns `false`; don't resurrect it.
- Tickets: Ticketmaster Discovery (read/search only; checkout reserve is intentionally mocked for the demo).

**State is in-memory + best-effort durable, per `src/lib/store.ts`.** The store lives on `globalThis` (module
singleton) and resets on cold start. On Vercel serverless this means packages/responses/collector sessions can
vanish between invocations — mid-flow WhatsApp conversations would silently reset. `src/lib/durable-state.ts`
+ `src/lib/state-sync.ts` mitigate this with a JSONBlob-backed snapshot (`AIDHD_STATE_BLOB_ID` /
`AIDHD_STATE_BLOB_URL`): every store mutation calls `schedulePersist()` (debounced 80ms flush), and
`ensureHydrated()`/`hydrateAidhdState()` merge remote state back in using step-rank comparison so a stale local
collector session doesn't clobber more-advanced remote progress. If you add a new piece of mutable state that
must survive across requests, wire it into the `DurablePayload` shape and the hydrate/flush merge logic —
don't assume the in-memory Map alone is durable.

**Agent subnet contract:** agent identities and message shape are typed in `src/lib/agents/types.ts`
(`AgentId`, `AgentRunResult`). Every agent step should call `pushAgentLog(eventId, step, detail)`
(`src/lib/store.ts`) so the run is visible in the event snapshot / demo UI — this is the audit trail the UI
renders, not just a debug log.

**WhatsApp specifics** (`src/lib/collector/whatsapp-bot.ts`, `src/lib/integrations/whatsapp*.ts`): Meta sandbox
requires an approved template as the first business-initiated message (freeform text only works within the
24h window after the user replies); temp tokens expire ~24h; recipient numbers must be E.164 with country
code. Webhook handlers must `await` reply sends (fire-and-forget drops messages on serverless) and dedupe
message IDs *after* successful handling so retries can recover from failed sends. See
`docs/CONTINGENCIES.md` for the full list of failure modes already hit and fixed here — read it before
touching the collector or webhook code.

## Key files

- `src/lib/agents/orchestrator.ts` — the planning subnet (outing vs trip agent fan-out); start here to
  understand how packages get built.
- `src/lib/store.ts` / `src/lib/durable-state.ts` / `src/lib/state-sync.ts` — in-memory store + serverless
  persistence.
- `src/lib/types.ts` — core domain model (`Event`, `Response`, `Package`, `Mandate`, `Booking`,
  `CollectorSession`).
- `src/lib/integrations/config.ts` — capability flags for every external integration; `integrationStatus()`
  backs `/api/health`.
- `src/app/api/events/[id]/*` — the event lifecycle: responses → reconcile → vote → mandates → book.
- `docs/CONTINGENCIES.md` — real failure modes hit building this (WhatsApp, consensus, serverless state,
  Prava). Required reading before changing collector, consensus, or state-sync code.
- `docs/API_KEYS.md` — informal key-acquisition guide for contributors; not authoritative on architecture.
