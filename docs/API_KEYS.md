# AiDHD — API keys & setup (for collaborators)

Share this file with teammates. **Do not put real secrets in this doc or in git.**  
Each person copies `.env.example` → `.env.local` and fills their own keys.

Hackathon: [Prava Agentic Commerce Hackathon 2026](https://agentic-commerce.devfolio.co/)  
Repo: https://github.com/Shivam-Sheth/AiDHD  
Local app: http://localhost:3000 · Health: http://localhost:3000/api/health

---

## Quick start

```bash
git clone https://github.com/Shivam-Sheth/AiDHD.git
cd AiDHD
npm install
cp .env.example .env.local
# fill keys below into .env.local
npm run dev
curl http://localhost:3000/api/health
```

Integrations show `live` or `mock` / `standby` in `/api/health`. Missing keys never crash the demo — they fall back to fixtures.

---

## Priority keys (hackathon)

| Priority | Env var(s) | Required? | Get it here |
|---:|---|---|---|
| 1 | `PRAVA_SECRET_KEY` (+ optional `PRAVA_API_KEY`, `PRAVA_PUBLISHABLE_KEY`) | **Yes for submission** | [Prava Dashboard](https://dashboard.prava.space/) · [Quickstart](https://docs.prava.space/quickstart) |
| 2 | `GEMINI_API_KEY` (+ optional `GEMINI_MODEL=gemini-2.5-flash`) | Strongly recommended | [Google AI Studio](https://aistudio.google.com/apikey) |
| 3 | `SENSO_API_KEY` | Strongly recommended | [Senso](https://senso.ai) · GEO: https://geo.senso.ai |
| 4 | `TICKETMASTER_API_KEY` | Nice for live concert search | [Ticketmaster Developers](https://developer.ticketmaster.com/) → **Discovery API** consumer key |
| 5 | `META_WHATSAPP_TOKEN` + `META_WHATSAPP_PHONE_NUMBER_ID` | Nice for WhatsApp demo | [Meta for Developers](https://developers.facebook.com/apps/) → app → **Use cases** → **Connect with customers through WhatsApp** → Step 1 |
| 6 | `OPENAI_API_KEY` | Optional fallback LLM | [OpenAI API keys](https://platform.openai.com/api-keys) |
| 7 | `LINQ_API_KEY` | Optional iMessage | [Linq](https://www.linqapp.com/) / hackathon portal |
| — | `META_WHATSAPP_TOKEN` extras | Optional | See WhatsApp section below |
| — | `LLAMA_API_KEY` | Optional | Meta Llama / Groq / Together |

---

## Full `.env.local` checklist

```bash
# LLM — Gemini preferred; OpenAI standby
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Prava (required for submission)
PRAVA_SECRET_KEY=
PRAVA_API_KEY=
PRAVA_PUBLISHABLE_KEY=

# Senso
SENSO_API_KEY=

# Linq (iMessage) — mock until set
LINQ_API_KEY=

# WhatsApp Cloud API
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_VERIFY_TOKEN=aidhd_verify
META_GRAPH_VERSION=v25.0
META_WHATSAPP_TEMPLATE=hello_world
META_WHATSAPP_TEMPLATE_LANG=en_US
WHATSAPP_DEFAULT_EVENT_ID=evt_demo_friday
# Optional: map demo user Jordan to a real test phone
WHATSAPP_JORDAN_PHONE=

# Ticketmaster Discovery
TICKETMASTER_API_KEY=

# Optional
LLAMA_API_KEY=
```

Never commit `.env.local`. Only `.env.example` is in git.

---

## How to get each key

### 1. Prava
1. Sign up: https://dashboard.prava.space/
2. Create an API key for entity **AiDHD**
3. Copy **secret key** (`sk_test_…`) → `PRAVA_SECRET_KEY`
4. Optional: publishable key → `PRAVA_PUBLISHABLE_KEY`
5. Docs: https://docs.prava.space/quickstart · Playground: https://playground.prava.space/

### 2. Gemini
1. https://aistudio.google.com/apikey
2. Create key → `GEMINI_API_KEY`
3. Prefer model `gemini-2.5-flash` (set `GEMINI_MODEL`)

### 3. Senso
1. https://senso.ai (or hackathon Senso CLI onboarding)
2. Put org API key in `SENSO_API_KEY`
3. Watch GEO: https://geo.senso.ai

### 4. Ticketmaster
1. https://developer.ticketmaster.com/
2. Create account → **Get Your API Key**
3. Use **Discovery API** consumer key → `TICKETMASTER_API_KEY`
4. Partner / Purchase / Presence APIs are **not** needed for this demo

### 5. Meta WhatsApp (sandbox)
There is often **no top-level “WhatsApp” nav**. Path:

1. https://developers.facebook.com/apps/ → open (or create) app **AiDHD**
2. Left sidebar → **Use cases**
3. **Connect with customers through WhatsApp** → **Step 1. Try it out**
4. Claim test number → copy:
   - Temporary **Access token** → `META_WHATSAPP_TOKEN` (regenerate ~24h)
   - **Phone number ID** → `META_WHATSAPP_PHONE_NUMBER_ID`
5. Under **Send a message from your test number** → **Recipient** dropdown → **Manage phone number list** → add friends’ `+1…` numbers (they must accept)
6. Webhooks (Step 2 → **Configure Webhooks** is fine for sandbox):
   - Callback URL: `https://YOUR-PUBLIC-TUNNEL/api/channels/whatsapp/webhook`
   - Verify token: `aidhd_verify` (must match `META_WHATSAPP_VERIFY_TOKEN`)
   - Subscribe to **`messages`**

**Sandbox test number shape:** Meta provides a `+1 (555) …` test line (not your personal SIM). Friends chat with **that** number.

Local tunnel example:

```bash
npx cloudflared tunnel --url http://localhost:3000
# paste https://….trycloudflare.com/api/channels/whatsapp/webhook into Meta
npm run whatsapp:keepalive   # optional — keeps webhook warm
```

If Meta inbound is flaky, use the site’s **Send as WhatsApp reply** box (calls `/api/channels/whatsapp/simulate`).

### 6. OpenAI (optional)
https://platform.openai.com/api-keys → `OPENAI_API_KEY`  
Used only if Gemini is missing/fails.

### 7. Linq (optional)
https://www.linqapp.com/ → `LINQ_API_KEY`  
Without it, iMessage stays a scripted preview.

---

## Verify everything

```bash
curl http://localhost:3000/api/health
```

Expect something like:

```json
{
  "integrations": {
    "llm": "gemini",
    "gemini": "live",
    "openai": "standby",
    "prava": "live",
    "senso": "live",
    "ticketmaster": "live",
    "whatsapp": "live",
    "linq": "mock",
    "nanda": "registered"
  }
}
```

---

## Security rules for the group

1. **Never** commit `.env.local` or paste keys into GitHub issues/PRs.
2. Prefer each person using **their own** sandbox keys.
3. If a key was pasted in chat/Slack, **rotate it** in the provider dashboard.
4. Meta temporary tokens expire ~24 hours — regenerate from Step 1 → **Generate token**.
5. Cloudflare quick tunnels change URL when restarted — update Meta webhook when that happens.

---

## Related product links

| Resource | URL |
|---|---|
| Hackathon | https://agentic-commerce.devfolio.co/ |
| Repo | https://github.com/Shivam-Sheth/AiDHD |
| Prava | https://www.prava.space/ · https://docs.prava.space/ |
| NANDA card (local) | http://localhost:3000/api/nanda/agent-card |
| Ticketmaster Discovery docs | https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ |
| Meta WhatsApp Cloud API | https://developers.facebook.com/docs/whatsapp/cloud-api |

Questions → open an issue on the repo or ping the project owner. Keep secrets in DMs / 1Password, not in this markdown file.
