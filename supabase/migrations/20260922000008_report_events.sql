-- ====================================================================
-- CLEAR ROAD — 008: report events (append-only audit)
--
-- A narrow append-only log of meaningful state changes per report. Helps
-- reason about report behaviour WITHOUT creating user movement histories:
-- no coordinates of users, no browsing trails. Payloads must stay small and
-- must never contain personal information or precise user positions.
--
-- Records meaningful changes such as report_created, confirmation_added,
-- clear_signal_added, lifecycle_changed, report_closed, moderation_changed.
-- Inserted only by security-definer functions; rows are never updated.
-- ====================================================================

set search_path = public, extensions;

create table public.report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  event_type public.report_event_type not null,
  session_id uuid references public.anonymous_sessions (id) on delete set null,
  message_id uuid references public.incident_messages (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index report_events_report_idx on public.report_events (report_id, created_at desc);
create index report_events_type_idx on public.report_events (event_type);
create index report_events_created_idx on public.report_events (created_at desc);

alter table public.report_events enable row level security;

-- No direct client access at all: events are consumed by trusted server
-- code (analytics, debugging, moderation context). service_role bypasses RLS.

comment on table public.report_events is
  'Append-only state-change log. No movement history, no PII in payloads.';