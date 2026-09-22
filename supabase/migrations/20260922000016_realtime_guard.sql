-- ====================================================================
-- CLEAR ROAD — 016: realtime guard
--
-- M0B has no realtime subscriptions, but Realtime is our plan for live map
-- updates in M4. This migration prepares the tables for Supabase Realtime by
-- joining the guard publication WITHOUT changing any RLS policy — so even if
-- a client subscribes, the existing RLS already decides what it may see.
--
-- At this point:
--   * reports            has NO anon/authenticated select policy  → nothing leaks
--   * incident_messages  only publishes its VISIBLE, open-report rows
--
-- Adding explicit realtime policies (and, later, a dedicated chat channel)
-- is deliberately deferred to M4 — see docs/MILESTONES.md.
-- ====================================================================

set search_path = public, extensions;

-- Supabase ships a default "supabase_realtime" publication. Be defensive:
-- only wire tables into it if the publication exists.
do $$
declare
  v_publication boolean;
  v_row record;
begin
  select exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) into v_publication;

  if v_publication then
    for v_row in
      select c.relname as tbl
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('reports', 'incident_messages')
        and not exists (
          select 1
          from pg_publication_tables pt
          where pt.pubname = 'supabase_realtime'
            and pt.schemaname = n.nspname
            and pt.tablename = c.relname
        )
    loop
      execute format('alter publication supabase_realtime add table public.%I', v_row.tbl);
    end loop;
  end if;
end;
$$;

comment on table public.reports is
  'In the supabase_realtime publication since M0B, but RLS keeps it closed until M4.';