# AiDHD keys — for the group chat / friends

yo — if you’re helping with AiDHD for the Prava hackathon, this is the informal “get your own keys” note.  
**don’t paste real secrets into github or this file.** put them in your own `.env.local`.

- hackathon: https://agentic-commerce.devfolio.co/
- repo: https://github.com/Shivam-Sheth/AiDHD
- after install, hit http://localhost:3000 and check http://localhost:3000/api/health

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

missing keys = mocks. you’re fine to run the UI without everything.

---

## what you actually need

**must-have for submission**
- `PRAVA_SECRET_KEY` → https://dashboard.prava.space/ (docs: https://docs.prava.space/quickstart)

**makes the agent feel real**
- `GEMINI_API_KEY` → https://aistudio.google.com/apikey  
  set `GEMINI_MODEL=gemini-2.5-flash`
- `SENSO_API_KEY` → https://senso.ai (geo board: https://geo.senso.ai)

**nice for the live demo**
- `TICKETMASTER_API_KEY` → https://developer.ticketmaster.com/ (Discovery API consumer key only)
- WhatsApp:
  - `META_WHATSAPP_TOKEN`
  - `META_WHATSAPP_PHONE_NUMBER_ID`
  - keep `META_WHATSAPP_VERIFY_TOKEN=aidhd_verify`
  - meta: https://developers.facebook.com/apps/ → your app → **Use cases** → **Connect with customers through WhatsApp** → Step 1  
    (there’s often no sidebar item literally named “WhatsApp”)

**optional**
- `OPENAI_API_KEY` → https://platform.openai.com/api-keys (fallback if gemini dies)
- `LINQ_API_KEY` → https://www.linqapp.com/ (imessage; mock without it)
- `LLAMA_API_KEY` → whatever llama host you use

---

## paste into `.env.local`

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

PRAVA_SECRET_KEY=
PRAVA_API_KEY=
PRAVA_PUBLISHABLE_KEY=

SENSO_API_KEY=

LINQ_API_KEY=

META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_VERIFY_TOKEN=aidhd_verify
META_GRAPH_VERSION=v25.0
META_WHATSAPP_TEMPLATE=hello_world
META_WHATSAPP_TEMPLATE_LANG=en_US
WHATSAPP_DEFAULT_EVENT_ID=evt_demo_friday
WHATSAPP_JORDAN_PHONE=

TICKETMASTER_API_KEY=
LLAMA_API_KEY=
```

---

## WhatsApp sandbox (friends as recipients)

1. Meta → Use cases → Connect with customers through WhatsApp → **Step 1. Try it out**
2. claim the **test number** (looks like `+1 (555) …`)
3. copy access token + phone number id into `.env.local`
4. Recipient dropdown → manage phone list → add buddies’ `+1…` numbers → they have to accept
5. webhook (when you want inbound replies):
   - callback: `https://YOUR-TUNNEL/api/channels/whatsapp/webhook`
   - verify token: `aidhd_verify`
   - subscribe: `messages`
6. tunnel locally:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   npm run whatsapp:keepalive
   ```
7. if inbound is flaky: on the site use **Send as WhatsApp reply** (skips Meta webhook)

bot chat is with the **555 test number**, not shivam’s personal phone. flow: budget → dates → vibe → `YES` → ticketmaster picks. cmds: `PLAN` / `EVENTS` / `PACKAGES`.

---

## Ticketmaster one-liner

developer.ticketmaster.com → login → get api key → Discovery only. ignore partner/purchase/presence.

---

## sanity check

```bash
curl http://localhost:3000/api/health
```

you want `prava`, `gemini`, `senso`, `ticketmaster`, `whatsapp` → `live` when you’ve keyed them.

---

## please don’t

- commit `.env.local`
- drop keys in the group chat forever (rotate if you already did)
- expect meta temp tokens to last more than ~24h — regenerate when it dies
- forget that cloudflare quick tunnel URLs change when you restart them

ping shivam if something’s weird. keep real keys in 1password / dm, not in this md.
