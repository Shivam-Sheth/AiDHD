-- AiDHD group parties (run in Supabase SQL editor after profiles.sql)
-- Partiful-style hosting + encrypted group chat with AiDHD as a bot member.
-- Messages are AES-GCM ciphertext (app encrypts). The bot is a participant
-- with server-side key access — same model as Meta AI in WhatsApp groups
-- (not peer-only E2E that would blind the agent).

create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  mode text not null check (mode in ('outing', 'trip')),
  place text not null default 'TBD',
  proposed_dates text[] not null default '{}',
  status text not null default 'collecting'
    check (status in (
      'collecting', 'planning', 'voting', 'review',
      'paying', 'booking', 'confirmed', 'cancelled'
    )),
  organizer_id text not null,
  spoc_user_id text,
  -- Opaque group key material (base64). Used with AIDHD_VAULT_KEY to encrypt messages.
  chat_key_wrapped text not null,
  legacy_event_id text,
  linq_chat_id text,
  whatsapp_thread_hint text,
  plan_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null,
  display_name text not null default '',
  email text not null default '',
  phone text,
  role text not null default 'member'
    check (role in ('organizer', 'spoc', 'member', 'bot')),
  channel text not null default 'web'
    check (channel in ('web', 'whatsapp', 'imessage', 'system')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  token text primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by text not null,
  max_uses int not null default 50,
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id text not null,
  sender_name text not null default '',
  -- AES-GCM ciphertext (base64url). Never store plaintext chat bodies.
  body_ciphertext text not null,
  mentions text[] not null default '{}',
  kind text not null default 'text'
    check (kind in (
      'text', 'system', 'agent', 'booking_prompt',
      'review_link', 'spoc_ask', 'tool_result'
    )),
  reply_to uuid references public.group_messages (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at);

create table if not exists public.group_booking_drafts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  category text not null
    check (category in ('flight', 'hotel', 'ticket', 'dining', 'trip')),
  status text not null default 'draft'
    check (status in (
      'draft', 'awaiting_info', 'awaiting_review',
      'awaiting_payment', 'booked', 'failed'
    )),
  party_size int not null default 1,
  travelers jsonb not null default '[]'::jsonb,
  offer jsonb not null default '{}'::jsonb,
  review_token text not null unique,
  prava_session_id text,
  prava_mandate_id text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_booking_drafts enable row level security;

-- App uses service role for group chat (encrypt/decrypt + bot). No anon policies.
-- Profiles remain user-JWT scoped; traveler_profiles stay service-role only.
