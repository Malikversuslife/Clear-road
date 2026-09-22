-- ====================================================================
-- CLEAR ROAD — 003: anonymous sessions
--
-- Privacy-preserving temporary identity. There is NO user account, email,
-- phone or permanent username. Sessions are:
--   * keyed by the Supabase anonymous-auth user id (auth.uid())
--   * given a server-generated cosmetic label ("ANON 82") — the client never
--     supplies or chooses its own label, so it cannot impersonate others
--   * allowed to expire; an expired session cannot act
--   * NOT linked to any movement history — no continuous location logging
--     exists anywhere in the schema
--
-- The label is display-only and NOT guaranteed unique. Unlinkability is
-- provided by the UUID, never by the label.
--
-- No FK to auth.users is declared on purpose: the sessions table should be
-- purgable independently of auth leftovers (see 015_maintenance.sql and
-- docs/PRIVACY_AND_TRUST.md).
-- ====================================================================

set search_path = public, extensions;

create table public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  constraint anonymous_sessions_label_format check (label ~ '^ANON [0-9]{2}$')
);

create index anonymous_sessions_expires_idx on public.anonymous_sessions (expires_at);

alter table public.anonymous_sessions enable row level security;

-- A session may read its own row (so the UI can show its label/expiry).
-- All mutation goes through the security-definer RPCs (INCLUDE get_my_session).
create policy "anonymous_sessions_select_own"
  on public.anonymous_sessions
  for select
  to anon, authenticated
  using (auth.uid() = id);

comment on table public.anonymous_sessions is
  'Temporary anonymous participation identity. No PII. See docs/PRIVACY_AND_TRUST.md.';