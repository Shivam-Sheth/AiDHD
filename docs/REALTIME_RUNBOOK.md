# AiDHD realtime runbook — parties + flight booking

Do these in order. Skip anything already green in Vercel env.

---

## A. Supabase (once) — personal project

Project: `https://fbjlmtxfdzrlfsbbyxss.supabase.co`

1. Open [/setup](/setup) in the app, or SQL editor:
   https://supabase.com/dashboard/project/fbjlmtxfdzrlfsbbyxss/sql/new
2. Paste **`supabase/ALL.sql`** → Run (profiles + vault + groups).
3. Auth → Providers → Google; redirect URI:
   `https://fbjlmtxfdzrlfsbbyxss.supabase.co/auth/v1/callback`
4. Env already points here in `.env.local` (and mirror on Vercel):
   - `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` = project root (**no** `/rest/v1`)
   - anon + service_role keys
   - `AIDHD_VAULT_KEY`
   - `OPENAI_API_KEY` (preferred for group chat)

---

## B. Keys for live booking

| Key | Purpose |
|-----|---------|
| `DUFFEL_API_KEY` | Live flight search + order create (test key OK) |
| `PRAVA_SECRET_KEY` + `PRAVA_PUBLISHABLE_KEY` | Collect / mandate |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID` | Voice concierge |
| `OPENAI_API_KEY` or `GEMINI_API_KEY` | Group-chat @AiDHD replies |
| `LINQ_API_KEY` + `LINQ_PHONE_NUMBER` | iMessage invites |
| `META_WHATSAPP_*` | WhatsApp invites |
| `AIDHD_STATE_BLOB_ID` | Durable WA state across serverless |

Duffel test account: top up **test balance** (balance payments) or orders fail with a clear error.

---

## C. Sync ElevenLabs (after every deploy)

```bash
curl -X POST https://YOUR_HOST/api/agent/sync
```

Leave the Workflow canvas **flat** (Start only). Do **not** import a hotel booking template.

New tools pushed: `check_passport_vault`, `confirm_flight_booking`.

---

## D. Partiful-style party (phone app / PWA)

1. On phone: open the site → **Install AiDHD** / iOS Share → **Add to Home Screen**.
2. Open `/groups` → set your name (or `/login`).
3. **New party** → title, city, outing/trip, dates.
4. In the chat header → **Invite friends**:
   - **Share invite link** → system share sheet (Messages, IG, AirDrop…)
   - **Text / iMessage** or **WhatsApp link** → native composers with the URL
   - **Add from Contacts** (Android Chrome / installed PWA when supported)
   - **Send via AiDHD WhatsApp / iMessage** for bot-delivered invites
5. Friends open `/invite/[token]` → join → same group chat.
6. Anyone tags `@AiDHD`. **I'll be SPOC** for restaurant bookings.

**iOS note:** Safari blocks the full Contacts picker for web apps — use Share link / Text. Android supports Add from Contacts.

---

## E. WhatsApp invite

1. Meta: numbers must be **allowlisted** test recipients with country code (`+1…`).
2. Webhook points at prod: `/api/channels/whatsapp/webhook` (keepalive script helps locally).
3. In the party → Invite friends → paste phones → **WhatsApp**.
4. They get Meta template first; after they reply, collector continues on that party’s event id.
5. Also share the **web invite** so they land in the same group chat UI.

---

## F. iMessage (Linq) invite

1. Linq sandbox is often **inbound-first** — friend texts your `LINQ_PHONE_NUMBER` first if create-chat fails.
2. Invite friends → phones → **iMessage**.
3. First Linq message is **link-free**; second message has the `/invite/…` URL.
4. Subscribe webhook once: `POST /api/channels/linq/subscribe` with your public URL.

---

## G. Realtime flight book (voice `/agent` or tools)

Exact sequence:

1. **Passport** — open `/account` (same browser session / same local user id as the party). Save passport. Agent never hears the number.
2. **Search** — `/agent` → “flights Chicago to NYC August 14 returning 16”.
3. Confirm cards show **Live · Duffel** and an `off_…` offer id (not JetBlue fixture).
4. **Vault check** — agent calls `check_passport_vault` (or you say “check my passport”).
5. **Pay** — “pay $X for United” → `create_payment` → complete **Prava Collect** on screen.
6. **Book** — “confirm that flight” → `confirm_flight_booking(offer_id, user_id)`  
   - Server decrypts passport → Duffel Orders → returns confirmation / PNR only.
7. If Duffel returns balance/payment errors: fund Duffel test balance or re-search (offers expire ~tens of minutes).

Group chat path:

1. `@AiDHD book flights` → review link in chat.
2. Everyone needing a ticket adds passport at `/account`.
3. Approve on review page → Prava → (same vault book path when wired from review; voice tool is live now).

---

## H. Quick smoke checklist

- [ ] `/groups/new` creates party + AiDHD bot welcome message  
- [ ] Web invite join works in a second browser/incognito  
- [ ] WhatsApp template lands on allowlisted phone  
- [ ] Linq second message contains invite URL  
- [ ] `@AiDHD what's the weather in Chicago` replies with context  
- [ ] `/account` shows passport “on file”  
- [ ] `/agent` search shows Duffel offers  
- [ ] Prava Collect completes  
- [ ] `confirm_flight_booking` returns a confirmation code  

---

## I. What not to do

- Don’t paste passports/PANs into ElevenLabs voice or group chat.
- Don’t enable a hotel Workflow template in ElevenLabs.
- Don’t expect OctoTrip to book — search/affiliate only; Duffel is the issuer.
