-- ====================================================================
-- CLEAR ROAD — 012: RPC messages (ROAD CHAT)
--
-- post_incident_message  → validate session + open report, insert, return JSON.
-- get_incident_messages  → open-report-scoped chat, VISIBLE only, 200 cap.
--
-- Mirrors src/features/chat/messages.ts.
-- ====================================================================

set search_path = public, extensions;

create or replace function public.post_incident_message(
  p_report_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(p_body);
  v_open boolean;
  v_expires_at timestamptz;
  v_session_ok boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if char_length(v_body) = 0 or char_length(v_body) > 500 then
    raise exception 'message must be between 1 and 500 characters'
      using errcode = '22023';
  end if;

  select (exists (
    select 1 from public.reports
    where id = p_report_id
      and lifecycle not in ('CLOSED')
      and expires_at > now()
  )) into v_open;

  if not v_open then
    raise exception 'report is closed or expired' using errcode = 'CR002';
  end if;

  select (expires_at > now())
    into v_session_ok
    from public.anonymous_sessions
   where id = v_uid;
  if not found then
    raise exception 'no anonymous session' using errcode = 'CR001';
  end if;
  if not v_session_ok then
    raise exception 'session expired' using errcode = 'CR002';
  end if;

  insert into public.incident_messages (report_id, session_id, body)
  values (p_report_id, v_uid, v_body)
  returning id into v_id;

  insert into public.report_events (report_id, event_type, session_id)
  values (p_report_id, 'MESSAGE_POSTED', v_uid);

  return public.incident_message_public_json(v_id);
end;
$$;

create or replace function public.get_incident_messages(p_report_id uuid)
returns table (
  id uuid,
  body text,
  label text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, extensions
as $$
  select m.id, m.body, s.label, m.created_at
  from public.incident_messages m
  join public.anonymous_sessions s on s.id = m.session_id
  where m.report_id = p_report_id
    and m.moderation_state = 'VISIBLE'
    and exists (
      select 1 from public.reports r
      where r.id = p_report_id
        and r.lifecycle not in ('CLOSED')
        and r.expires_at > now()
    )
  order by m.created_at asc
  limit 200;
$$;

revoke execute on function public.post_incident_message(uuid, text) from public;
revoke execute on function public.get_incident_messages(uuid) from public;
grant execute on function public.post_incident_message(uuid, text) to anon, authenticated;
grant execute on function public.get_incident_messages(uuid) to anon, authenticated;