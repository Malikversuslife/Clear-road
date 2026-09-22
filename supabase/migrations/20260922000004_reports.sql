-- ====================================================================
-- CLEAR ROAD — 004: reports
--
-- A report is a claim, not an established fact. Location uses PostGIS
-- geography(Point, 4326) so later viewport / radius / duplicate queries are
-- indexed with a GiST index.
--
-- Lifecycle and confidence columns are materialised by the security-definer
-- RPC functions (see 009/010/011). The authoritative reference logic for
-- lifecycle/expiry/confidence lives in src/features/reports/*.ts and is
-- mirrored by the SQL functions — keep them in sync.
-- ====================================================================

set search_path = public, extensions;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  category public.report_category not null,
  location geography(Point, 4326) not null,
  note text,
  lifecycle public.report_lifecycle not null default 'NEW',
  confidence public.report_confidence not null default 'UNCONFIRMED',
  session_id uuid not null references public.anonymous_sessions (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  expires_at timestamptz not null,
  closed_at timestamptz,
  constraint reports_note_length check (
    note is null or (char_length(btrim(note)) between 1 and 280)
  ),
  constraint reports_expiry_after_creation check (expires_at > created_at),
  constraint reports_closed_at_consistency check (
    closed_at is null or lifecycle = 'CLOSED'
  ),
  constraint reports_last_confirmed_range check (
    last_confirmed_at is null or last_confirmed_at >= created_at
  )
);

-- Geospatial lookup: reports near a viewport / within a radius.
create index reports_location_gist on public.reports using gist (location);

-- Live-safe expiry scan: the maintenance job and active-report queries hit
-- this partial index only.
create index reports_expires_partial on public.reports (expires_at)
  where lifecycle <> 'CLOSED';

create index reports_category_idx on public.reports (category);
create index reports_created_at_idx on public.reports (created_at desc);

-- Transactionally safe last-updated bookkeeping.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reports_set_updated_at
  before update on public.reports
  for each row
  execute function public.set_updated_at();

alter table public.reports enable row level security;

-- NO direct SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated:
-- the browser never touches this table; all report access is mediated by
-- security-definer RPCs (create_report, confirm_report, active_reports,
-- get_report_by_id). This is the central trust boundary — see
-- docs/ARCHITECTURE.md ("The client is untrusted").

comment on table public.reports is
  'Crowdsourced road reports. Claims, not facts. Read/write via RPCs only.';