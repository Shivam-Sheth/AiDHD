# AiDHD

**Concierge for group nights & trips — the agent that finishes the job.**

Built for [Prava's Agentic Commerce Hackathon](https://agentic-commerce.devfolio.co/) (Jul 31–Aug 2 2026). One person starts a **night out** or a **multi-day trip**, the group drops budgets & prefs from web / WhatsApp / iMessage, AiDHD reconciles into 2–3 costed packages, the group votes, and the agent books end-to-end with **separate Prava mandates per cost category** (tickets/dining for outings; flights/hotel/dining/activities for travel).

> Working name in the build prompt was "Splitrip". Product brand in this repo: **AiDHD**.

## Platform upgrade (v2)

The hackathon core has been extended into a production-shaped group booking,
purchasing, and AI-concierge platform:

- **Auth** — Supabase email/password on the existing screens, Google OAuth,
  password reset (`/reset-password`), logout, and guarded routes. Demo
  localStorage sessions still work when Supabase isn't configured.
- **Groups & realtime chat** — Supabase Realtime (live messages, typing,
  read receipts, unread badges), replies, reactions, edit/delete, polls,
  file sharing, owner/admin/member roles, invites by link / email / phone /
  @username.
- **@Prava in every group chat** — tag `@Prava` to search flights/hotels/
  dining/tickets/products, create polls, summarize the chat, suggest plans,
  place research calls, and add plans to Google Calendar. Every external,
  financial, or legally meaningful action posts an **Approve/Decline card**
  first — nothing executes without a human tap.
- **Calling** — AI-assisted outbound calls (ElevenLabs) to restaurants,
  hotels, airlines, venues, ticket providers, stores, and support desks,
  plus user-led calls with a generated script (`POST /api/calls/script`).
- **SMS concierge (Linq)** — link your phone (Account → Text Prava, verify
  with `LINK <code>`), then text things like "book a table for four tomorrow
  at 8pm". Options come back numbered; actions need an explicit YES;
  confirmations sync into your group chat. No payment/passport data over SMS.
- **Google Calendar** — OAuth connect on Account; encrypted token storage;
  the agent asks approval before creating events.
- **Payments** — unchanged Prava-hosted checkout; agent-initiated payments
  are approval-gated.
- **Provider architecture** — `src/lib/providers/` registry (auth, groups,
  chat, agent, flights, hotels, dining, events, commerce, calls, SMS,
  calendar, payments, notifications). The `CommerceProvider` interface has a
  fixture implementation; the **Shopify module (owned by another team)**
  plugs in via `registerCommerceProvider()`.

Database: run `supabase/ALL.sql` then **`supabase/upgrade_v2.sql`** in the
Supabase SQL editor. Check readiness at `/api/setup/status`.

## Why this exists

Group chats are where plans go to die — Friday concerts and weekend getaways alike. Three budgets, two vibes, zero bookings. AiDHD reconciles the mess and actually pays + reserves — without one scary lump-sum charge.

## Demo (2–3 min script)

```bash
npm install
npm run dev
# open http://localhost:3000
```

Click the numbered actions in the UI:

1. **Seed demo group** — Maya (web), Jordan (WhatsApp), Sam (iMessage) with conflicting budgets/prefs  
2. **Generate packages** — OpenAI-orchestrated reconcile + merchant search + **Senso** trust scores  
3. **Pick Best match + mandates** — requests **separate Prava mandates** for ticket and dining  
4. **Approve mandates** — passkey-style approval (simulated until `PRAVA_SECRET_KEY` is set)  
5. **Book (fail ticket)** — shows resilient partial failure: only the ticket mandate fails  
6. **Re-mandate ticket** — re-requests **only** that category  
7. **Finish booking** — confirms remaining legs + fans out confirmation  

Channel transcripts (WhatsApp task-scoped collector + Linq iMessage) are visible on the same page for the cold open.

## Architecture

```
Web chat / WhatsApp / iMessage
            │
            ▼
     Ingestion API  (POST /api/events/:id/responses)
            │
            ▼
  Reconciliation agent (OpenAI tool loop)
     ├─ ticket search (Ticketmaster or fixtures)
     ├─ dining search (Linq/fixtures)
     └─ Senso vendor trust
            │
            ▼
   Package vote → per-category Prava mandates
            │
            ▼
   Booking executor + confirmation fan-out
```

NANDA AgentFacts card: [`/api/nanda/agent-card`](./src/lib/integrations/nanda.ts)  
A2A ping: `POST /api/nanda/a2a` with `{ "method": "trust.ping" }`

## Track alignment

| Track | How AiDHD earns it |
|---|---|
| **OpenAI** | Reconciliation agent with tool-style steps (merchant search, Senso, mandate orchestration); optional Responses API polish when `OPENAI_API_KEY` is set |
| **Prava** | Separate mandate per category; partial-failure re-mandate; mandate breakdown UI |
| **Senso** | Trust score + "Verified via Senso" on every package component |
| **Linq** | iMessage collector preview + dining/confirmation hooks |
| **Visa** | Prava mandate → single-use token model (Trusted Agent Protocol concepts) |
| **Project NANDA** | AgentFacts registration + A2A endpoint |
| **Localhost** | Productized demo narrative that can live past the weekend |

## MVP cuts (intentional)

- **Outing** mode is fully wired end-to-end in the live demo (tickets + dinner). **Travel** is a first-class product surface (same collect → package → per-category Prava flow for flights, hotel, itinerary, dining); trip inventory uses realistic fixtures for the hackathon while outing booking stays live.  
- Hardcoded 3-person demo group — no auth.  
- Integrations degrade to realistic mocks until keys are supplied. **Prava must be live for the final submission.**  
- WhatsApp/iMessage show live-shaped transcripts; wire sandbox credentials via `.env.local` (see `.env.example`).  
- Ticketmaster Discovery is read/search; checkout reserve step is mocked for the demo (disclosed).

## API quickstart

```bash
# reset + seed
curl -X POST http://localhost:3000/api/demo/reset
curl -X POST http://localhost:3000/api/demo/seed-responses

# ingest a response (same schema for all channels)
curl -X POST http://localhost:3000/api/events/evt_demo_friday/responses \
  -H 'content-type: application/json' \
  -d '{
    "user_id":"user_maya",
    "channel":"web",
    "budget_cap":150,
    "preferences":{"free_text":"Brooklyn, vegetarian","structured_tags":["brooklyn"]},
    "availability":["2026-08-07"]
  }'

# reconcile → packages
curl -X POST http://localhost:3000/api/events/evt_demo_friday/reconcile

# health / integration modes
curl http://localhost:3000/api/health
```

## Credentials

Copy `.env.example` → `.env.local`. The app never blocks on missing credentials (falls back to mocks/fixtures).

**Shareable setup guide for teammates:** [`docs/API_KEYS.md`](./docs/API_KEYS.md)  
(links for Prava, Gemini, Senso, Ticketmaster, Meta WhatsApp — no secrets in that file)

Priority order for the hackathon weekend:

1. `PRAVA_SECRET_KEY` (required for submission)  
2. `GEMINI_API_KEY` (preferred LLM; OpenAI optional fallback)  
3. `SENSO_API_KEY`  
4. `TICKETMASTER_API_KEY` / Meta WhatsApp / `LINQ_API_KEY`  

## Stack

- Next.js 16 (App Router) + TypeScript  
- In-memory store (demo-scale; swap for Postgres later)  
- OpenAI SDK, Prava session/mandate stubs, Senso trust lookup, Ticketmaster Discovery, Linq/WhatsApp channel adapters  

## Repo

https://github.com/Shivam-Sheth/AiDHD
