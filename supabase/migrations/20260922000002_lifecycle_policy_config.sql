-- ====================================================================
-- CLEAR ROAD — 002: lifecycle policy configuration
--
-- The expiry/lifecycle policy lives HERE in the database (single row) and is
-- mirrored in TypeScript by src/features/reports/lifecycle.ts, which is the
-- reference implementation for tests. Changing policy means updating BOTH —
-- see docs/DATA_MODEL.md for the change procedure.
--
-- Keep these durations testable and configuration-driven, never hard-coded
-- inside report rows or the application UI.
-- ====================================================================

set search_path = public, extensions;

create table public.lifecycle_policy_config (
  id boolean primary key default true,
  -- Base lifetime of a fresh report.
  initial_lifetime interval not null default interval '45 minutes',
  -- Extra lifetime per independent STILL_DEY confirmation (capped).
  confirmation_extension interval not null default interval '15 minutes',
  -- Max confirmation count that may extend expiration.
  max_confirmations_counted integer not null default 4,
  -- Hard cap on lifetime regardless of confirmations.
  max_lifetime interval not null default interval '3 hours',
  -- ACTIVE decays to STALE after this long without a fresh confirmation.
  stale_after interval not null default interval '15 minutes',
  -- STALE reports stay closable for this long before auto-CLOSED (EXPIRED).
  stale_grace interval not null default interval '30 minutes',
  -- A brand-new uncorroborated report is NEW for this long.
  new_window interval not null default interval '5 minutes',
  -- Placeholder overnight-window start hour, replaced by a real
  -- sunset/sunrise service in M5 (see src/features/reports/lifecycle.ts).
  overnight_start_hour integer not null default 18,
  -- DON_CLEAR signals required to close a report.
  don_clear_close_threshold integer not null default 1,
  -- LOW / MEDIUM / HIGH confidence thresholds (independent STILL_DEY count).
  confidence_low_threshold integer not null default 1,
  confidence_medium_threshold integer not null default 2,
  confidence_high_threshold integer not null default 4,
  constraint lifecycle_policy_config_single_row check (id)
);

insert into public.lifecycle_policy_config (id)
values (true)
on conflict (id) do nothing;