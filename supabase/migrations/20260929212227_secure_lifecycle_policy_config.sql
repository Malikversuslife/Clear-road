-- Internal lifecycle configuration must never be accessible through the browser API.
-- No client policies: database-owner SECURITY DEFINER RPCs retain access.
alter table public.lifecycle_policy_config enable row level security;
revoke all privileges on table public.lifecycle_policy_config from public, anon, authenticated;

-- The timestamp trigger only needs PostgreSQL built-ins.
alter function public.set_updated_at() set search_path = pg_catalog;
