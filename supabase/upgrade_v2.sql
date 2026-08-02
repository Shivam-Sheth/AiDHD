-- AiDHD v2 upgrade — run in Supabase SQL editor AFTER profiles.sql,
-- traveler_profiles.sql and groups.sql (or ALL.sql).
--
-- Adds: richer profiles (username/phone), member admin role, message
-- edit/delete/reactions/read receipts, group polls, approval-gated agent
-- actions, Google Calendar connections, SMS identity links, notifications,
-- and a public bucket for chat file sharing.
--
-- Model stays the same as groups.sql: the app talks to these tables with the
-- service role (RLS enabled, no anon policies — deny by default). Realtime
-- uses broadcast channels (no table replication needed).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: username / phone / avatar so invites can target them
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;
create index if not exists profiles_phone_idx
  on public.profiles (phone)
  where phone is not null;
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Group member roles: owner (organizer) / admin / member (+ existing spoc/bot)
-- ---------------------------------------------------------------------------
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check
  check (role in ('organizer', 'admin', 'spoc', 'member', 'bot'));

create index if not exists group_members_user_idx
  on public.group_members (user_id);

-- Invites can now target a specific email / phone / username
alter table public.group_invites add column if not exists invited_email text;
alter table public.group_invites add column if not exists invited_phone text;
alter table public.group_invites add column if not exists invited_username text;
alter table public.group_invites add column if not exists role text not null default 'member'
  check (role in ('admin', 'member'));
create index if not exists group_invites_group_idx
  on public.group_invites (group_id);

-- ---------------------------------------------------------------------------
-- Messages: edit / soft delete / richer kinds
-- ---------------------------------------------------------------------------
alter table public.group_messages add column if not exists edited_at timestamptz;
alter table public.group_messages add column if not exists deleted_at timestamptz;

alter table public.group_messages drop constraint if exists group_messages_kind_check;
alter table public.group_messages add constraint group_messages_kind_check
  check (kind in (
    'text', 'system', 'agent', 'booking_prompt',
    'review_link', 'spoc_ask', 'tool_result',
    'poll', 'approval_request', 'share', 'file'
  ));

create index if not exists group_messages_reply_idx
  on public.group_messages (reply_to)
  where reply_to is not null;

-- Reactions (one row per user+emoji per message)
create table if not exists public.message_reactions (
  message_id uuid not null references public.group_messages (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null,
  user_name text not null default '',
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_group_idx
  on public.message_reactions (group_id);

-- Read receipts / unread counts (last-read watermark per member)
create table if not exists public.message_reads (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  last_read_message_id uuid,
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Polls (created by members or by @Prava)
-- ---------------------------------------------------------------------------
create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  message_id uuid references public.group_messages (id) on delete set null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  created_by text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists group_polls_group_idx
  on public.group_polls (group_id, created_at);

create table if not exists public.group_poll_votes (
  poll_id uuid not null references public.group_polls (id) on delete cascade,
  user_id text not null,
  user_name text not null default '',
  option_index int not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Approval-gated agent actions — @Prava must get explicit user approval
-- before any external / financial / legally meaningful action.
-- ---------------------------------------------------------------------------
create table if not exists public.action_approvals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  user_id text,                    -- direct (non-group) requests, e.g. SMS
  message_id uuid,                 -- approval_request chat message
  kind text not null check (kind in (
    'payment', 'booking', 'reservation', 'purchase', 'cancellation',
    'calendar_create', 'calendar_update', 'calendar_delete',
    'outbound_call', 'outbound_message', 'other'
  )),
  summary text not null,
  amount_usd numeric,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'declined', 'executed', 'failed', 'expired'
  )),
  requested_by text not null,      -- bot id or user id
  decided_by text,
  decided_at timestamptz,
  result jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists action_approvals_group_idx
  on public.action_approvals (group_id, status, created_at);
create index if not exists action_approvals_user_idx
  on public.action_approvals (user_id, status)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- Google Calendar connections (tokens AES-GCM encrypted by the app —
-- never store plaintext OAuth tokens)
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_connections (
  user_id text primary key,
  provider text not null default 'google',
  account_email text not null default '',
  tokens_ciphertext text not null,
  scope text not null default '',
  expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SMS identity links (Linq) — verified phone ↔ app user
-- ---------------------------------------------------------------------------
create table if not exists public.sms_links (
  phone text primary key,          -- normalized digits, e.g. 15551234567
  user_id text not null,
  user_name text not null default '',
  verify_code text,
  verified boolean not null default false,
  default_group_id uuid references public.groups (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sms_links_user_idx on public.sms_links (user_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  link text,
  group_id uuid references public.groups (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Booking drafts: universal categories
-- ---------------------------------------------------------------------------
alter table public.group_booking_drafts drop constraint if exists group_booking_drafts_category_check;
alter table public.group_booking_drafts add constraint group_booking_drafts_category_check
  check (category in (
    'flight', 'hotel', 'ticket', 'dining', 'trip',
    'event', 'movie', 'class', 'appointment', 'experience',
    'product', 'other'
  ));
create index if not exists group_booking_drafts_group_idx
  on public.group_booking_drafts (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Chat file sharing bucket (uploads go through the server API)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-uploads', 'chat-uploads', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — enable everywhere; service role bypasses. Deny-by-default for anon.
-- ---------------------------------------------------------------------------
alter table public.message_reactions enable row level security;
alter table public.message_reads enable row level security;
alter table public.group_polls enable row level security;
alter table public.group_poll_votes enable row level security;
alter table public.action_approvals enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.sms_links enable row level security;
alter table public.notifications enable row level security;

-- Authenticated users may read their own notifications directly (optional).
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications"
  on public.notifications for select
  using (auth.uid()::text = user_id);
