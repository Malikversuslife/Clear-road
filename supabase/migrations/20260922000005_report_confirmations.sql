-- ====================================================================
-- CLEAR ROAD — 005: report confirmations
--
-- Two community signals per report: STILL_DEY / DON_CLEAR.
--
-- Integrity is enforced in the database, not just the frontend:
--   * UNIQUE (report_id, session_id) — a session can signal a given report
--     at most once; no repeated inflation.
--   * The reporter can never confirm their own report (checked inside the
--     confirm_report RPC: report.session_id <> auth.uid()).
--   * signal is a database enum — malformed values are rejected by the DB.
--   * confirmations against closed/expired reports are rejected in the RPC
--     which also serialises against races with SELECT ... FOR UPDATE.
--
-- Rows are attributable to an anonymous session internally but the table is
-- NOT readable by the browser; only aggregated counts are exposed through the
-- active_reports RPC (which never reveals WHO confirmed).
-- ====================================================================

set search_path = public, extensions;

create table public.report_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  session_id uuid not null references public.anonymous_sessions (id) on delete restrict,
  signal public.confirmation_signal not null,
  created_at timestamptz not null default now(),
  constraint report_confirmations_one_signal_per_session unique (report_id, session_id)
);

-- Confirmation counts per report (used by active_reports aggregation).
create index report_confirmations_report_idx on public.report_confirmations (report_id, created_at);
create index report_confirmations_session_idx on public.report_confirmations (session_id);

alter table public.report_confirmations enable row level security;

-- No anon/authenticated SELECT policies: raw confirmations expose
-- session linkage and are never needed by the client.

comment on table public.report_confirmations is
  'Community signals on reports. One signal per session per report. Not directly readable by clients.';