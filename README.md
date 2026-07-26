# AiDHD

**Group planning agent that finishes the job.**

Built for [Prava's Agentic Commerce Hackathon](https://agentic-commerce.devfolio.co/) (Jul 31–Aug 2 2026). One person starts an outing, the group drops budgets & prefs from web / WhatsApp / iMessage, AiDHD reconciles into 2–3 costed packages, the group votes, and the agent books end-to-end with **separate Prava mandates per cost category**.

> Working name in the build prompt was "Splitrip". Product brand in this repo: **AiDHD**.

## Why this exists

Group chats are where nights go to die: three budgets, two vibes, zero bookings. AiDHD is the agent that reconciles the mess and actually pays + reserves — without asking for one scary lump-sum charge.

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

- **Outing** mode is fully wired (tickets + dinner). Trip mode shares the data model but stubs flights/hotel.  
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

Copy `.env.example` → `.env.local`. Ask for keys as each phase needs them — the app never blocks on missing credentials.

Priority order for the hackathon weekend:

1. `PRAVA_SECRET_KEY` (required for submission)  
2. `OPENAI_API_KEY`  
3. `SENSO_API_KEY`  
4. `LINQ_API_KEY` / Meta WhatsApp / Ticketmaster  

## Stack

- Next.js 16 (App Router) + TypeScript  
- In-memory store (demo-scale; swap for Postgres later)  
- OpenAI SDK, Prava session/mandate stubs, Senso trust lookup, Ticketmaster Discovery, Linq/WhatsApp channel adapters  

## Repo

https://github.com/Shivam-Sheth/AiDHD
