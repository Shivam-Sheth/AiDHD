# AiDHD contingencies — prompt inject for a similar app

Copy this into a build prompt. These are real failure modes we hit building WhatsApp group planning (Ticketmaster + Duffel + Prava) for the Prava Agentic Commerce Hackathon.

## Product shape

1. Channels (WhatsApp/web) **collect only**: mode → budget → (trip: origin/destination) → date range → vibe (outing required; trip optional / SKIP) → confirm.
2. A **multi-agent subnet** builds **one shared package list** for the whole group (outing: tickets+dining; trip: flights+hotels, plus destination tickets if vibe asks for movie/concert/etc).
3. **Prava** comes after vote: separate spend mandates per category (ticket / dining / flight / hotel), then book.
4. Voice (ElevenLabs) is optional polish — not required for core demo.

---

## Contingencies (must-handle)

### 1. WhatsApp / Meta messaging
- **Temp tokens expire ~24h** → auth errors on invite; refresh `META_WHATSAPP_TOKEN` and redeploy.
- **Sandbox allowlist**: every recipient must be Meta-approved with **country code** (`+1773…` not `+773…`). Normalize 10-digit US numbers to `1…`.
- **First business message must be an approved template** (`hello_world` by default). Freeform text **cannot** send until the user replies (24h session window).
- Flow: template → user says hi → then friendly opener. Don’t expect a second freeform right after the template.
- **Webhook must be subscribed to `messages`** on the WABA; override callback to your prod URL. Local tunnels die — use production webhook for demos.
- Webhook handlers must **await** reply sends (fire-and-forget drops messages on serverless).
- Dedup message IDs **after** successful handling so retries can recover from send failures.

### 2. Collector UX / NLU
- Don’t hard-require exact strings like `hi` only — use an LLM (Gemini) for greetings, typos, bare day numbers (`11-20`), vibe free-text; **regex as fallback**.
- Mode first: `TRIP` vs `OUTING`/`PLAN`. Never infer mode from vibe text (“New York, chill”) mid-flow — that randomly flipped users to trip.
- While a session is mid-collect (`budget`…`confirm`), **ignore mode reclassification** unless the user sends a short standalone `TRIP` / `OUTING` / `PLAN`.
- Ask for **date ranges**, not fixed Fri/Sat demo nights. Vague `either`/`any` → re-ask for a concrete range.
- Vibe examples: activities/food/drinks (`movie`, `escape room`, `lunch/dinner`, `veg`, `alc`) — not neighborhoods.
- Multi-field first messages: parse budget **and** dates **and** vibe from one blob; don’t drop everything after the first number.

### 3. Group consensus (same packages for everyone)
- Generate packages **once per group** from **all** responses; broadcast the **same** list to every member who submitted.
- Do **not** regenerate a private list after each individual’s YES with only their prefs (causes different choices).
- **Dates:** compute majority free window; people with weak overlap get pinged: `EXCEPTION` to join, or re-enter a new range.
- **Budget:** compute group middle-ground (avg/median blend). People materially under it get pinged: `RAISE` / `KEEP` / `BUDGET 150`.
- Packages should label **consensus dates** and note equal weighing + target $/person.

### 4. Inventory / merchants
- Ticketmaster/Duffel can return empty or over-budget filters can wipe fixtures → **never crash on `offer.vendor`**; fall back to cheapest inventory.
- Low budgets ($60) that filter out all dining/tickets must still return something (cheapest options) or a clear “no inventory” error.
- Amadeus self-service is dead — hotels via **Duffel Stays**, not Amadeus.
- **Never default flights to JFK→MIA.** Resolve origin/destination from user prefs (`origin_city` / `destination` + IATA tags). Fixtures must be rewritten to the asked route. Hotels use city coords — not Miami-unless-said-so.

### 4b. Reel share (app + WhatsApp)
- Accept Instagram/TikTok reel URL (or pasted transcript). Gemini decodes caption/transcript → city, dates, events, budget hints.
- Ask only what’s missing: party size, date pick (if multiple), time, budget, origin (if trip).
- Show Ticketmaster matches + itinerary sketch; `APPROVE N` to lock. Frontend: `POST /api/reel/plan`.

### 5. Serverless state (Vercel)
- In-memory store is **per instance**. Packages/responses/votes vanish between requests → `VOTE 2` said “no packages yet” after packages were just shown; mid-collect can reset to “Hey I'm AiDHD”.
- Mitigations: **durable blob** (`AIDHD_STATE_BLOB_ID` → JSONBlob) hydrates contacts/collectors/responses/packages on each webhook; also checkpoint draft on the WhatsApp contact; on `VOTE`, regenerate shared packages if missing.
- Demo seed users ≠ WhatsApp users; don’t assume web seed responses exist in the WhatsApp process.

### 6. Payments (Prava — the hackathon core)
- Prava is **not** search. Order: collect → shared packages → vote → **per-category mandates** → approve → book.
- If one leg fails, re-mandate **only that category**.

### 7. Voice / ElevenLabs (optional)
- Agent ID ≠ phone number ID. Outbound needs API key + agent phone number ID (usually Twilio import).
- Freeform after template rules still apply to WhatsApp replies about research calls.

---

## Suggested command surface

| User says | Meaning |
|---|---|
| `OUTING` / `PLAN` | Night out mode |
| `TRIP` | Travel mode (+ origin city/country + destination) |
| budget / dates / vibe / `YES` | Collector steps |
| `PACKAGES` | Rebuild + resend **shared** list |
| `VOTE 1\|2\|3` | Pick package (regenerate if store empty) |
| `EXCEPTION` | Accept majority date window |
| `RAISE` / `KEEP` / `BUDGET N` | Accept / refuse / custom group budget target |
| `RESEARCH Venue \| +phone \| question` | Optional dual-agent research |

---

## Prompt blurb (pasteable)

```
Build a WhatsApp-first group outing/trip planner. Collect mode (outing|trip), budget, date range, vibe (and for trips: origin city/country + destination). Use an LLM to parse messy natural language with regex fallback. Never switch modes mid-collection from vibe text. After confirms, weigh all members equally and emit ONE shared package list to everyone. Resolve date conflicts via majority window + EXCEPTION/re-enter. Resolve budget conflicts via group middle-ground + RAISE/KEEP/BUDGET N. Persist group state across serverless instances (or regenerate on VOTE). Merchants: Ticketmaster + Duffel (flights/stays). Payments: Prava separate mandate per category after vote. Meta WhatsApp: template first, freeform only after user reply; handle expired tokens and allowlisted E.164 numbers.
```
