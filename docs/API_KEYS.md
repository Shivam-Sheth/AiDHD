# AiDHD keys — for the group chat / friends

yo — if you’re helping with AiDHD for the Prava hackathon, this is the informal “get your own keys” note.  
**don’t paste real secrets into github or this file.** put them in your own `.env.local`.

- hackathon: https://agentic-commerce.devfolio.co/
- repo: https://github.com/Shivam-Sheth/AiDHD
- live (keyed deploy): https://aidhd-omega.vercel.app
- after install, hit http://localhost:3000 and check http://localhost:3000/api/health
- agent subnet card: http://localhost:3000/api/agents

**architecture reminder:** WhatsApp/web = **collect only**. Multi-agent subnet does search → packages → Prava → book → voice confirm.

---

## 60-second setup

```bash
git clone https://github.com/Shivam-Sheth/AiDHD.git
cd AiDHD
npm install
cp .env.example .env.local
# fill keys (below), then:
npm run dev
```

---

## what you actually need

### Core (submission)
| Key | Link |
|---|---|
| `PRAVA_SECRET_KEY` | https://dashboard.prava.space/ |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL=gemini-2.5-flash`) | https://aistudio.google.com/apikey |
| `SENSO_API_KEY` | https://senso.ai |

### Outing merchants
| Key | Link |
|---|---|
| `TICKETMASTER_API_KEY` | https://developer.ticketmaster.com/ (Discovery) |
| dining | fixtures now; later Resy/OpenTable via Linq |

### Travel merchants
| Key | Link | Notes |
|---|---|---|
| `DUFFEL_API_KEY` | https://duffel.com/ | **flights + hotels** (Duffel Stays). One token. Fixtures if empty. |

~~Amadeus self-service~~ is **decommissioned** (enterprise-only now). Don’t sign up there — use Duffel Stays instead: https://duffel.com/docs/guides/getting-started-with-stays

### Channels
| Key | Link |
|---|---|
| `META_WHATSAPP_TOKEN` + `META_WHATSAPP_PHONE_NUMBER_ID` | https://developers.facebook.com/apps/ → Use cases → WhatsApp |
| `LINQ_API_KEY` + `LINQ_PHONE_NUMBER` | https://linqapp.com/hackathon → sandbox signup (Hackathon). E.164 number from dashboard. Webhook: `POST /api/channels/linq/subscribe` |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `AIDHD_VAULT_KEY` | Supabase project + run `supabase/traveler_profiles.sql`. Vault key encrypts passports; agent only sees refs. |

### Voice / live Concierge (ElevenLabs)
| Key | Notes |
|---|---|
| `ELEVENLABS_API_KEY` | https://elevenlabs.io → API keys |
| `ELEVENLABS_AGENT_ID` | Conversational agent used on **/agent** (real-time lookups + Prava) |
| Sync tools | After deploy: `curl -X POST https://aidhd-omega.vercel.app/api/agent/sync` |

**Preferred demo:** open https://aidhd-omega.vercel.app/agent → Start voice (or type) → “flights Chicago to Bali” → “pay $780 for United” → Prava panel.

Outbound phone templates (`ELEVENLABS_HOTEL_AGENT_ID` / research) are optional legacy.

### Optional
| Key | Link |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `LLAMA_API_KEY` | groq / together / meta |
| `TWILIO_*` | only if not using ElevenAgents outbound |

---

## paste into `.env.local`

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=

PRAVA_SECRET_KEY=
PRAVA_API_KEY=
PRAVA_PUBLISHABLE_KEY=

SENSO_API_KEY=
TICKETMASTER_API_KEY=

DUFFEL_API_KEY=

META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_VERIFY_TOKEN=aidhd_verify
META_GRAPH_VERSION=v25.0
META_WHATSAPP_TEMPLATE=hello_world
# Cross-instance WhatsApp state (JSONBlob id) — stops mid-flow "Hey I'm AiDHD" resets
AIDHD_STATE_BLOB_ID=

LINQ_API_KEY=

ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
VOICE_CONFIRM_PHONE=
```

---

## how the agent subnet works

1. **Collector** (WhatsApp / web / Linq) — budget, dates, vibe only  
2. **Orchestrator** — fans out to specialists  
3. **tickets / dining / flights / hotels / itinerary / trust** — build 2–3 packages  
4. **payments** — separate Prava mandate per category  
5. **voice** — ElevenLabs script/audio + optional Twilio call to confirm  

`GET /api/agents` lists the subnet. Demo UI has **Outing** vs **Travel (Miami)** toggles.

---

## WhatsApp sandbox

test number looks like `+1 (555) …`  
webhook (prod): `https://aidhd-omega.vercel.app/api/channels/whatsapp/webhook`  
verify: `aidhd_verify`  
subscribe: `messages`

**Chat commands (after Ticketmaster + Duffel keys):**  
`OUTING` — Friday tickets + dinner · `TRIP` / `MIAMI` — flights + hotels  
budget → dates → vibe → `YES` (auto package lookup) · or `PACKAGES` · `VOTE 1`

---

## please don’t

- commit `.env.local`
- expect the collector bot to book stuff (it won’t — by design)
- forget Meta temp tokens die ~24h

ping shivam if something’s weird.
