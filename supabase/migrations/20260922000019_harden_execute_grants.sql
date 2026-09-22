-- ====================================================================
-- CLEAR ROAD — 019: harden RPC/helper execute grants
--
-- ROOT CAUSE discovered during M0B.5 live verification:
--   Every migraton revoked EXECUTE with `revoke ... from public`, but the
--   Supabase project's DEFAULT PRIVILEGES for the public schema grant
--   EXECUTE to anon, authenticated AND service_role when a function is
--   created (visible in pg_default_acl). `revoke from public` therefore
--   only removed the blanket PUBLIC grant, leaving internal/helper and
--   housekeeping functions callable by browsers:
--
--     * report_public_json / incident_message_public_json  – PUBLIC + anon
--       -> exposes the sanitised view of ANY report by id, including
--          CLOSED/expired ones silently dropped from active_reports
--     * run_lifecycle_pass / purge_expired_sessions         – anon
--       -> browsers could trigger housekeeping (close reports, purge
--          sessions) at will
--     * refresh_lifecycle / effective_expiry /
--       confidence_from_count / generate_anon_label         – anon
--       -> internal helpers never meant to be caller-callable
--     * get_my_session                                      – PUBLIC
--       -> should be anon/authenticated only
--
-- FIX: revoke explicitly from public / anon / authenticated (helpers stay
-- callable by the security-definer owners, which run as postgres, so the
-- public RPCs are unaffected). service_role keeps access to the
-- housekeeping functions — that is its intended job.
-- ====================================================================

set search_path = public, extensions;

-- Browser-facing RPCs (the ONLY functions users may execute).
-- get_my_session: PUBLIC revoked; anon/authenticated grants from 00010 keep it working.
revoke execute on function public.get_my_session() from public;

-- Internal helpers: not caller-callable. Security-definer RPCs execute them
-- as postgres (the owner), so revoking browser roles is safe.
revoke execute on function public.placeholder_sunrise(timestamptz) from public, anon, authenticated;
revoke execute on function public.effective_expiry(text, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.confidence_from_count(integer) from public, anon, authenticated;
revoke execute on function public.refresh_lifecycle(uuid) from public, anon, authenticated;
revoke execute on function public.generate_anon_label() from public, anon, authenticated;
revoke execute on function public.report_public_json(uuid) from public, anon, authenticated;
revoke execute on function public.incident_message_public_json(uuid) from public, anon, authenticated;

-- Housekeeping: service_role only.
revoke execute on function public.run_lifecycle_pass() from public, anon, authenticated;
revoke execute on function public.purge_expired_sessions(interval) from public, anon, authenticated;

grant execute on function public.run_lifecycle_pass() to service_role;
grant execute on function public.purge_expired_sessions(interval) to service_role;