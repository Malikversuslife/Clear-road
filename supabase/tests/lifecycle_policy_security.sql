-- Run with supabase db query --linked --file <this file>.
-- All synthetic sessions, reports and events are rolled back.
begin;
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.lifecycle_policy_config'::regclass) then
    raise exception 'RLS is disabled';
  end if;
  if exists (
    select 1 from unnest(array['anon', 'authenticated']) r,
      unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
    where has_table_privilege(r, 'public.lifecycle_policy_config', p)
  ) then raise exception 'Client table privileges remain'; end if;
  if not (select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid = 'public.set_updated_at()'::regprocedure) then
    raise exception 'Trigger search path not hardened';
  end if;
end $$;
do $$
begin
  if exists (
    select 1 from unnest(array[
      'public.get_my_session()',
      'public.create_report(text,double precision,double precision,text)',
      'public.confirm_report(uuid,text)',
      'public.post_incident_message(uuid,text)',
      'public.flag_content(text,uuid,uuid,text,text)'
    ]) f
    where has_function_privilege('anon', f, 'EXECUTE')
      or not has_function_privilege('authenticated', f, 'EXECUTE')
  ) then raise exception 'Incorrect session RPC privileges'; end if;
  if exists (
    select 1 from unnest(array['anon','authenticated']) r,
      unnest(array['anonymous_sessions','reports','report_confirmations','incident_messages','moderation_flags','report_events']) t,
      unnest(array['TRUNCATE','REFERENCES','TRIGGER']) p
    where has_table_privilege(r, 'public.' || t, p)
  ) then raise exception 'Browser table-management privileges remain'; end if;
end $$;
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) then raise exception 'Privileged public function still exposed'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='clear_road_private' and p.prosecdef) <> 7 then
    raise exception 'Missing private implementations';
  end if;
  if has_schema_privilege('anon','clear_road_private','CREATE') or
     has_schema_privilege('authenticated','clear_road_private','CREATE') then
    raise exception 'Client can create private objects';
  end if;
end $$;
set local role anon;
do $$
begin
  begin
    perform * from public.lifecycle_policy_config;
    raise exception 'Anonymous table read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform * from public.active_reports(6.5244, 3.3792, 0.001);
end $$;
reset role;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$
declare
  v_report jsonb;
begin
  begin
    update public.lifecycle_policy_config set initial_lifetime = initial_lifetime;
    raise exception 'Authenticated config update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform public.get_my_session();
  v_report := public.create_report('road_hazard', 6.5244, 3.3792, 'Transaction-only security regression test');
  if v_report->>'id' is null or v_report->>'expires_at' is null then
    raise exception 'Report creation/lifecycle failed';
  end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform public.get_my_session();
  perform public.confirm_report((v_report->>'id')::uuid, 'STILL_DEY');
  perform public.post_incident_message((v_report->>'id')::uuid, 'Transaction-only verification');
  if not exists (select 1 from public.get_incident_messages((v_report->>'id')::uuid)) then
    raise exception 'Message read failed';
  end if;
  perform public.flag_content('REPORT', (v_report->>'id')::uuid, null, 'SPAM', 'Transaction-only verification');
end $$;
reset role;
select 'PASS: RLS, privileges, trigger, public map read, session, report creation and confirmation' as result;
rollback;
