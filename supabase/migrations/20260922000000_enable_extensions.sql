-- ====================================================================
-- CLEAR ROAD — 000: extensions
--
-- PostGIS = geospatial support (report locations, viewport queries).
-- pgcrypto = robust random UUID generation.
--
-- Both extensions are installed into the "extensions" schema on Supabase;
-- every table/function that needs them sets search_path to include it.
-- ====================================================================

set search_path = public, extensions;

create extension if not exists postgis schema extensions;
create extension if not exists pgcrypto schema extensions;

-- Ensure the database roles can use the geospatial functions/types.
grant usage on schema extensions to anon, authenticated, service_role;

comment on extension postgis is 'PostGIS — geospatial foundation for CLEAR ROAD report locations';