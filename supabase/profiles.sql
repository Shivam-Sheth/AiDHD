-- AiDHD user profiles (run in Supabase SQL editor)
-- Populated by /api/auth/profile after Supabase Auth (Google) sign-in.
-- id matches auth.users.id — written via anon key + user JWT, not service role.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
