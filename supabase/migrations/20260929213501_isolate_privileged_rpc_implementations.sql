-- Keep privileged implementations outside the PostgREST-exposed public schema.
-- Invoker entry points preserve API signatures without granting direct table access.
create schema clear_road_private;
revoke all on schema clear_road_private from public, anon, authenticated;
grant usage on schema clear_road_private to anon, authenticated, service_role;
alter default privileges in schema clear_road_private revoke execute on functions from public, anon, authenticated;

do $migration$
declare
  f record;
  call_args text;
  wrapper_body text;
begin
  for f in
    select p.oid, p.proname, p.pronargs, p.provolatile,
      pg_get_function_arguments(p.oid) as args,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_result(p.oid) as result_type
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('active_reports', 'get_incident_messages', 'get_my_session', 'create_report',
       'confirm_report', 'post_incident_message', 'flag_content')
  loop
    select coalesce(string_agg('$' || i, ', ' order by i), '') into call_args
      from generate_series(1, f.pronargs) i;
    execute format('alter function public.%I(%s) set schema clear_road_private', f.proname, f.identity_args);
    wrapper_body := format('select * from clear_road_private.%I(%s)', f.proname, call_args);
    execute format('create function public.%I(%s) returns %s language sql security invoker %s set search_path = '''' as %L',
      f.proname, f.args, f.result_type,
      case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
      wrapper_body);
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', f.proname, f.identity_args);
    execute format('revoke all on function clear_road_private.%I(%s) from public, anon, authenticated', f.proname, f.identity_args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', f.proname, f.identity_args);
    execute format('grant execute on function clear_road_private.%I(%s) to authenticated, service_role', f.proname, f.identity_args);
    if f.proname in ('active_reports', 'get_incident_messages') then
      execute format('grant execute on function public.%I(%s) to anon', f.proname, f.identity_args);
      execute format('grant execute on function clear_road_private.%I(%s) to anon', f.proname, f.identity_args);
    end if;
  end loop;
end $migration$;
notify pgrst, 'reload schema';
