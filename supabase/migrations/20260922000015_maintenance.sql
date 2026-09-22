-- ====================================================================
-- CLEAR ROAD — 015: maintenance
--
-- Background (scheduled) work that keeps the live product clean. These are
-- called by a trusted scheduler with the service role — never by browsers.
-- Supabase does not provide cron by default; M4 will wire a scheduler
-- (pg_cron or an external worker). The functions themselves are idempotent
-- and safe to call repeatedly.
-- ====================================================================

set search_path = public, extensions;

-- ------------------------------------------------------------------
-- Recompute lifecycle for every non-closed report and close anything that
-- has slipped past STALE_GRACE. Handles sun-policy overrides and keeps the
-- materialised lifecycle column honest between user actions.
-- ------------------------------------------------------------------
create or replace function public.run_lifecycle_pass()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
  v_rec record;
begin
  v_count := 0;
  for v_rec in
    select id
    from public.reports
    where lifecycle <> 'CLOSED'
  loop
    perform public.refresh_lifecycle(v_rec.id);
    if exists (
      select 1 from public.reports
      where id = v_rec.id and lifecycle = 'CLOSED'
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ------------------------------------------------------------------
-- Delete anonymous sessions that expired long ago (retention grace).
-- Their reports remain (attribution is not required for history).
-- ------------------------------------------------------------------
create or replace function public.purge_expired_sessions(p_retention_grace interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  delete from public.anonymous_sessions
  where expires_at < now() - p_retention_grace;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Browsers must not invoke housekeeping.
revoke execute on function public.run_lifecycle_pass() from public;
revoke execute on function public.purge_expired_sessions(interval) from public;
grant execute on function public.run_lifecycle_pass() to service_role;
grant execute on function public.purge_expired_sessions(interval) to service_role;