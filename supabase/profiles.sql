-- AiDHD user profiles (run in Supabase SQL editor)
-- Populated by /api/auth/profile after Supabase Auth sign-in.
-- id matches auth.users.id — written via anon key + user JWT or service role.
-- Also run supabase/app_schema.sql for groups, friends, chat, splits.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text,
  handle text,
  phone text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists handle text,
  add column if not exists phone text,
  add column if not exists avatar_url text;

create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle))
  where handle is not null and handle <> '';

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Authenticated users can search profiles" on public.profiles;
create policy "Authenticated users can search profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
