-- AiDHD — Row-Level Security, indexes, and Realtime publication.
-- Run in the Supabase SQL editor after groups.sql / profiles.sql.
--
-- Why this file exists:
--   groups.sql enables RLS on five tables but defines no policies. With RLS on
--   and no policy, Postgres denies every row, so the app only works because the
--   server uses the service_role key, which bypasses RLS entirely. That means
--   there is currently no database-level isolation between groups — a single
--   authz slip in a route exposes every group's messages.
--
--   It also blocks Realtime: Supabase Realtime enforces RLS, so browser
--   subscriptions receive nothing until these policies exist.
--
-- Note on identity: group_members.user_id is `text`, not a uuid FK to
-- auth.users, so every comparison casts auth.uid()::text. Keep that convention
-- if you add tables.

-- ---------------------------------------------------------------------------
-- Membership helper
--
-- SECURITY DEFINER on purpose: a policy on group_members that itself queries
-- group_members recurses. Running the check inside a definer function bypasses
-- RLS for that lookup and breaks the cycle. It is STABLE and takes only a group
-- id, so it cannot be used to read anything the caller shouldn't see.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()::text
  );
$$;

create or replace function public.is_group_organizer(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid
      and user_id = auth.uid()::text
      and role in ('organizer', 'spoc')
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_organizer(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_organizer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
  for select to authenticated
  using (public.is_group_member(id));

drop policy if exists groups_insert_self on public.groups;
create policy groups_insert_self on public.groups
  for insert to authenticated
  with check (organizer_id = auth.uid()::text);

drop policy if exists groups_update_organizer on public.groups;
create policy groups_update_organizer on public.groups
  for update to authenticated
  using (public.is_group_organizer(id))
  with check (public.is_group_organizer(id));

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
drop policy if exists group_members_select_member on public.group_members;
create policy group_members_select_member on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

-- Self-join is what an invite redemption does; organizers may add anyone.
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid()::text or public.is_group_organizer(group_id));

drop policy if exists group_members_update_self_or_organizer on public.group_members;
create policy group_members_update_self_or_organizer on public.group_members
  for update to authenticated
  using (user_id = auth.uid()::text or public.is_group_organizer(group_id));

-- Leave a group yourself, or be removed by an organizer.
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete to authenticated
  using (user_id = auth.uid()::text or public.is_group_organizer(group_id));

-- ---------------------------------------------------------------------------
-- group_invites
--
-- Deliberately no anon select policy: redeeming an invite is a server action
-- using the service role, which looks the token up and enforces uses/expiry.
-- Exposing this table to anon would let anyone enumerate tokens.
-- ---------------------------------------------------------------------------
drop policy if exists group_invites_select_member on public.group_invites;
create policy group_invites_select_member on public.group_invites
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_invites_insert_organizer on public.group_invites;
create policy group_invites_insert_organizer on public.group_invites
  for insert to authenticated
  with check (public.is_group_organizer(group_id) and created_by = auth.uid()::text);

drop policy if exists group_invites_delete_organizer on public.group_invites;
create policy group_invites_delete_organizer on public.group_invites
  for delete to authenticated
  using (public.is_group_organizer(group_id));

-- ---------------------------------------------------------------------------
-- group_messages
-- ---------------------------------------------------------------------------
drop policy if exists group_messages_select_member on public.group_messages;
create policy group_messages_select_member on public.group_messages
  for select to authenticated
  using (public.is_group_member(group_id));

-- You may only post as yourself, and only into a group you belong to.
drop policy if exists group_messages_insert_member on public.group_messages;
create policy group_messages_insert_member on public.group_messages
  for insert to authenticated
  with check (public.is_group_member(group_id) and sender_id = auth.uid()::text);

-- Edit / delete your own messages only. Agent and system messages are written
-- by the service role and are not editable from the client.
drop policy if exists group_messages_update_own on public.group_messages;
create policy group_messages_update_own on public.group_messages
  for update to authenticated
  using (sender_id = auth.uid()::text)
  with check (sender_id = auth.uid()::text);

drop policy if exists group_messages_delete_own on public.group_messages;
create policy group_messages_delete_own on public.group_messages
  for delete to authenticated
  using (sender_id = auth.uid()::text or public.is_group_organizer(group_id));

-- ---------------------------------------------------------------------------
-- group_booking_drafts
-- ---------------------------------------------------------------------------
drop policy if exists group_booking_drafts_select_member on public.group_booking_drafts;
create policy group_booking_drafts_select_member on public.group_booking_drafts
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_booking_drafts_write_member on public.group_booking_drafts;
create policy group_booking_drafts_write_member on public.group_booking_drafts
  for insert to authenticated
  with check (public.is_group_member(group_id));

drop policy if exists group_booking_drafts_update_member on public.group_booking_drafts;
create policy group_booking_drafts_update_member on public.group_booking_drafts
  for update to authenticated
  using (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- profiles — a user may only read and write their own row
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid()::text);

drop policy if exists profiles_upsert_own on public.profiles;
create policy profiles_upsert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid()::text);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- traveler_profiles holds passport ciphertext. No client policies at all:
-- server-only, service role, by design.

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Only one existed (group_messages by group+created). Every policy above does a
-- membership lookup, so group_members needs to be fast on both directions.
-- ---------------------------------------------------------------------------
create index if not exists group_members_user_idx
  on public.group_members (user_id);
create index if not exists group_members_group_role_idx
  on public.group_members (group_id, role);
create index if not exists groups_organizer_idx
  on public.groups (organizer_id);
create index if not exists groups_slug_idx
  on public.groups (slug);
create index if not exists group_invites_group_idx
  on public.group_invites (group_id);
create index if not exists group_messages_reply_idx
  on public.group_messages (reply_to) where reply_to is not null;
create index if not exists group_booking_drafts_group_idx
  on public.group_booking_drafts (group_id);

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Subscriptions deliver rows through RLS, so this is only safe now that the
-- policies above exist. Without them a subscriber receives nothing; without
-- RLS at all a subscriber would receive everything.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.group_booking_drafts;

-- Needed for UPDATE/DELETE payloads to carry the old row, which the client
-- needs to reconcile edits and deletions.
alter table public.group_messages replica identity full;
alter table public.group_members replica identity full;
