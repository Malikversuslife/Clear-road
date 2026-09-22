-- ====================================================================
-- CLEAR ROAD — 007: moderation flags
--
-- Minimal data foundation for future moderation (spam, harassment, personal
-- information, dangerous content, false reports, abuse of anonymity). No
-- admin dashboard in M0B — schema + RLS only. Exactly one target (report OR
-- message) per flag is enforced structurally.
-- ====================================================================

set search_path = public, extensions;

create table public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  target_type public.moderation_target not null,
  report_id uuid references public.reports (id) on delete cascade,
  message_id uuid references public.incident_messages (id) on delete cascade,
  reason public.moderation_reason not null,
  note text,
  status public.moderation_status not null default 'OPEN',
  -- Who raised the flag (null = system-generated flag).
  session_id uuid references public.anonymous_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint moderation_flags_exactly_one_target check (
    (target_type = 'REPORT' and report_id is not null and message_id is null) or
    (target_type = 'MESSAGE' and message_id is not null and report_id is null)
  ),
  constraint moderation_flags_note_length check (
    note is null or char_length(btrim(note)) <= 200
  )
);

create index moderation_flags_status_idx on public.moderation_flags (status, target_type);
create index moderation_flags_report_idx on public.moderation_flags (report_id);
create index moderation_flags_message_idx on public.moderation_flags (message_id);

alter table public.moderation_flags enable row level security;

-- Entering flags is allowed for everyone via flag_content RPC; a user may
-- read only flags they raised; nobody may update/delete flags from the
-- browser (moderation workflow is server/service-role-only).
create policy "moderation_flags_select_own"
  on public.moderation_flags
  for select
  to anon, authenticated
  using (auth.uid() = session_id);

comment on table public.moderation_flags is
  'Moderation queue foundation. Flags are entries; review happens server-side.';