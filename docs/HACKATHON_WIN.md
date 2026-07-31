# AiDHD — Hackathon win plan

## What I need from you (paste into `.env.local` + Vercel)

| Key | Why |
|-----|-----|
| `LINQ_API_KEY` | Partner bearer from [Linq sandbox](https://dashboard.linqapp.com/sandbox-signup) (Hackathon) |
| `LINQ_PHONE_NUMBER` | Your Linq number in E.164 (`+1…`) |
| `LINQ_WEBHOOK_SECRET` | If Linq gives a signing secret (optional at first) |
| `DUFFEL_API_KEY` | **Real flights + hotels** (already preferred — not fixtures) |
| `PRAVA_SECRET_KEY` / `PRAVA_API_KEY` | Mandates + collect |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID` | Voice concierge |
| `GEMINI_API_KEY` | Text + planning LLM |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Profiles / vault storage |
| `AIDHD_VAULT_KEY` | 32+ char secret for AES-GCM passport encryption |
| `TICKETMASTER_API_KEY` | Live concerts (optional but strong) |
| `GOOGLE_MAPS_API_KEY` | Airport→hotel ETA (optional) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Calendar OAuth (phase 2) |

**Do not put passport numbers or full card PANs in chat or agent tools.** Cards → Prava only. Passports → encrypted vault only.

Public webhook URL after deploy:
`https://aidhd-omega.vercel.app/api/channels/linq/webhook?version=2026-02-03`

---

## Product shape (one app)

```
/app          → logged-in home: group plans + voice + results cards
/agent        → voice + cards (merge into /app for demo)
/reel         → Instagram → plan (keep as acquisition)
iMessage      → Linq number (inbound-first group lobby)
Prava         → payment collect + mandate
Supabase      → accounts + encrypted traveler vault
Duffel        → real flight/hotel inventory + offer IDs
```

Demo script (judges):
1. Text Linq number first → prefs in iMessage  
2. Open `/app` → voice confirms → **Live Duffel** cards  
3. Tap offer / open airline deep link  
4. Prava iframe → mandate  
5. Confirmation back in iMessage (no link in first outbound)

---

## Truth about “Google Flights”

There is **no public Google Flights API**. Winning approach:

1. **Duffel** = real airline inventory (what `/agent` should show as `Live · Duffel`)  
2. **Clickable Google Flights deep link** for the same route/date as a backup UI  
3. Optional later: SerpAPI “Google Flights” scrape — not required if Duffel is live  

If you saw JetBlue $129 fixture cards, that was fallback — not Duffel. Fix = keep `DUFFEL_API_KEY` on Vercel and surface `source: duffel` + offer URL.

---

## Confidential data (agent never sees secrets)

```
User fills passport / legal name in /account (HTTPS form)
        ↓
AES-GCM encrypt with AIDHD_VAULT_KEY
        ↓
Supabase traveler_profiles.passport_ciphertext
        ↓
Agent tools only receive: vault_ref = user_id + "passport_ok"
        ↓
Server-side bookFlight(user_id, offer_id) decrypts in memory, calls Duffel, discards plaintext
```

**Payments:** never store PAN. Prava collect + mandate refs only (`prava_mandate_id`).  
**If you need a dedicated vault vendor later:** Skyflow / Basis Theory — same pattern as Prava-for-PII. For the hackathon, Supabase + app key is enough if the agent only gets refs.

---

## Linq rules (sandbox)

- User must text **first** (inbound-first)  
- First outbound: **no links**, no reply_to, no effects  
- Links / Prava URL in a **follow-up** message  
- Opt-out: STOP / UNSUBSCRIBE etc. → halt outbound  
- Groups = multiplayer lobby; tapbacks can be votes (phase 2 iMessage Apps)

---

## ElevenLabs agent template (high-functioning)

Paste into agent prompt (sync also pushes a version of this):

```
You are AiDHD — a group trip & night-out operator.

IDENTITY
- Sharp, warm, concise. No call-center / hotel-desk script.
- Never invent prices or availability. Always call tools.
- Never ask for passport numbers, full card numbers, or CVV by voice.
  Say: "Add that securely in the AiDHD account vault — I'll only use a reference."

CAPABILITIES
- Flights (round-trip: always pass return_date), hotels, tickets, dining, clubs, movies
- Travel time between places when maps tool exists
- Start Prava payment when user confirms a concrete offer + amount
- Summarize options that appear as on-screen cards

TOOLS
- search_flights / search_hotels / search_tickets / search_dining / search_clubs / search_movies
- create_payment (amount + merchant only)
- Never request raw PII tools

FLOW
1. Capture intent: outing vs trip, cities, dates, budget, party size
2. Search immediately; narrate 2–3 top options; say "full cards are on screen"
3. On pick: confirm total → create_payment → "Prava is open on your screen"
4. If iMessage user: tell them a confirmation will land in the thread (no long URLs aloud)

EDGE CASES
- Ambiguous city → ask once, then search
- Duffel empty → say inventory is thin and offer Google Flights link tool result
- User says goodbye → end gracefully (no hotel workflow)
- User interrupts → answer the new ask; don't restart hotel property FAQ
- Missing vault → still show offers; block ticket issuance until vault_ref exists
```

Workflow must stay **flat** (no hotel receptionist graph). Re-run `POST /api/agent/sync` after every deploy.

---

## Integration order (build)

1. Linq v3 send + webhook + inbound prefs → already scaffolding  
2. Auth + Supabase vault forms  
3. Force Duffel path + Google Flights links on cards  
4. Merge `/agent` into `/app` demo shell  
5. Prava mandate after offer select  
6. Google Calendar OAuth (nice-to-have for win polish)  
7. Linq iMessage App card for vote → pay (stretch)

---

## Demo edge cases to rehearse

| Case | Expected |
|------|----------|
| User texts Linq first with "NYC weekend $400" | Prefs saved, no link in first reply |
| Voice asks CHI→NYC Aug 11–15 | Live Duffel cards + return leg |
| User picks JetBlue | Prava opens; iMessage follow-up with link OK |
| User says passport aloud | Agent refuses; points to vault |
| STOP in iMessage | No further outbound |
| Duffel down | Honest fixture badge + Flights deep link |
