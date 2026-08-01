# Supabase setup (production)

Run these SQL files in the Supabase SQL editor, in order:

1. `profiles.sql` — auth-linked user profiles  
2. `traveler_profiles.sql` — encrypted passport / Prava traveler vault  
3. `app_schema.sql` — friendships, trip groups, chat, expenses, settlements  

## Auth

- Enable **Email** provider (Authentication → Providers) for sign-up / sign-in on `/login`
- Enable **Google** if you want OAuth (redirect URI is Supabase’s `/auth/v1/callback`)
- Site URL + redirect allow-list should include your Vercel URL and `/auth/callback`

## Env (Vercel)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=   # same URL
SUPABASE_SERVICE_ROLE_KEY=  # required for durable groups/friends/chat
AIDHD_VAULT_KEY=            # ≥16 chars — passport AES-GCM
OPENAI_API_KEY=             # group Meta-AI style agent (preferred)
```

Without `SUPABASE_SERVICE_ROLE_KEY`, the app still authenticates real users but keeps groups/chat in memory for that server instance.
