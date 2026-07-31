-- AiDHD traveler profiles (run in Supabase SQL editor)
-- Passport fields are AES-GCM ciphertext from the app — never store plaintext.

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

-- Service role bypasses RLS; no anon policies on purpose (server-only writes).
