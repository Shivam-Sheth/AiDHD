-- AiDHD production schema
-- Run once in the Supabase SQL editor (after profiles.sql + traveler_profiles.sql).
-- Server APIs use the service role after verifying the caller's JWT.

-- ---------------------------------------------------------------------------
-- Profiles (extend)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists handle text,
  add column if not exists phone text,
  add column if not exists avatar_url text;

create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle))
  where handle is not null and handle <> '';

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- Friends can look up each other by id once friended (service role also used).
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Authenticated users can search profiles" on public.profiles;
create policy "Authenticated users can search profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'accepted'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint friendships_distinct check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

alter table public.friendships enable row level security;

drop policy if exists "Friends select own" on public.friendships;
create policy "Friends select own"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Friends insert own" on public.friendships;
create policy "Friends insert own"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

drop policy if exists "Friends update own" on public.friendships;
create policy "Friends update own"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ---------------------------------------------------------------------------
-- Trip groups
-- ---------------------------------------------------------------------------
create table if not exists public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null default 'TBD',
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'planning'
    check (status in ('planning', 'collecting', 'voting', 'paying', 'booking', 'confirmed', 'archived')),
  booking_event_id text,
  source_reel_url text,
  trip_brief jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_group_members (
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists trip_group_members_user_idx
  on public.trip_group_members (user_id);

alter table public.trip_groups enable row level security;
alter table public.trip_group_members enable row level security;

drop policy if exists "Members read groups" on public.trip_groups;
create policy "Members read groups"
  on public.trip_groups for select
  using (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Owners insert groups" on public.trip_groups;
create policy "Owners insert groups"
  on public.trip_groups for insert
  with check (auth.uid() = created_by);

drop policy if exists "Members update groups" on public.trip_groups;
create policy "Members update groups"
  on public.trip_groups for update
  using (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members read membership" on public.trip_group_members;
create policy "Members read membership"
  on public.trip_group_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_group_members m
      where m.group_id = trip_group_members.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members insert membership" on public.trip_group_members;
create policy "Members insert membership"
  on public.trip_group_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.trip_group_members m
      where m.group_id = trip_group_members.group_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Group chat
-- ---------------------------------------------------------------------------
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  content text not null,
  kind text not null default 'text'
    check (kind in ('text', 'system', 'agent', 'reel', 'expense')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx
  on public.group_messages (group_id, created_at);

alter table public.group_messages enable row level security;

drop policy if exists "Members read messages" on public.group_messages;
create policy "Members read messages"
  on public.group_messages for select
  using (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_messages.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members insert messages" on public.group_messages;
create policy "Members insert messages"
  on public.group_messages for insert
  with check (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_messages.group_id and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Splitwise-style expenses
-- ---------------------------------------------------------------------------
create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  paid_by uuid not null references public.profiles (id),
  splits jsonb not null default '[]'::jsonb,
  category text,
  source text not null default 'manual'
    check (source in ('manual', 'booking', 'package', 'agent')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id),
  to_user_id uuid not null references public.profiles (id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  note text,
  created_at timestamptz not null default now()
);

alter table public.group_expenses enable row level security;
alter table public.group_settlements enable row level security;

drop policy if exists "Members expenses" on public.group_expenses;
create policy "Members expenses"
  on public.group_expenses for all
  using (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_expenses.group_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_expenses.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members settlements" on public.group_settlements;
create policy "Members settlements"
  on public.group_settlements for all
  using (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_settlements.group_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trip_group_members m
      where m.group_id = group_settlements.group_id and m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Align traveler vault keys with auth uuids (text pk kept for compatibility)
-- ---------------------------------------------------------------------------
-- traveler_profiles.user_id should be auth.users.id::text
-- No schema change required; app writes uuid strings.
