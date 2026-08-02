-- AiDHD full schema — paste into Supabase SQL Editor and click Run
-- Project: https://supabase.com/dashboard/project/fbjlmtxfdzrlfsbbyxss/sql/new

-- ========== profiles ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ========== traveler_profiles (encrypted passport vault) ==========
create table if not exists public.traveler_profiles (
  user_id text primary key,
  email text not null default '',
  display_name text not null default '',
  phone text,
  passport_ciphertext text,
  passport_skipped boolean not null default false,
  prava_customer_id text,
  prava_card_last4 text,
  prava_card_brand text,
  prava_enrollment_id text,
  prava_mandate_id text,
  prava_mandate_status text,
  updated_at timestamptz not null default now()
);

alter table public.traveler_profiles enable row level security;

-- ========== groups / chat / invites / booking drafts ==========
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
