-- ====================================================================
-- CLEAR ROAD — 013: RPC moderation (flagging)
--
-- flag_content lets any session flag ONE target (report or message, not both)
-- with one reason. It records the flag into the moderation queue; escalation
-- and resolution happen server-side with the service role (M3).
--
-- Mirrors src/features/moderation/flags.ts.
-- ====================================================================

set search_path = public, extensions;

create or replace function public.flag_content(
  p_target_type text,
  p_report_id uuid,
  p_message_id uuid,
  p_reason text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.moderation_target;
  v_reason public.moderation_reason;
  v_note text;
  v_id uuid;
  v_session_ok boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  begin
    v_target := p_target_type::public.moderation_target;
  exception when invalid_text_representation then
    raise exception 'invalid target type' using errcode = '22023';
  end;

  begin
    v_reason := p_reason::public.moderation_reason;
  exception when invalid_text_representation then
    raise exception 'invalid reason' using errcode = '22023';
  end;

  if (v_target = 'REPORT' and (p_report_id is null or p_message_id is not null)) or
     (v_target = 'MESSAGE' and (p_message_id is null or p_report_id is not null)) then
    raise exception 'flag target and provided ids do not match' using errcode = '22023';
  end if;

  -- Ensure the referenced target actually exists.
  if v_target = 'REPORT' then
    if not exists (select 1 from public.reports where id = p_report_id) then
      raise exception 'report not found' using errcode = 'P0002';
    end if;
  else
    if not exists (select 1 from public.incident_messages where id = p_message_id) then
      raise exception 'message not found' using errcode = 'P0002';
    end if;
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

  select nullif(btrim(coalesce(p_note, '')), '') into v_note;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'note exceeds 200 characters' using errcode = '22023';
  end if;

  insert into public.moderation_flags (target_type, report_id, message_id, reason, note, session_id)
  values (v_target, p_report_id, p_message_id, v_reason, v_note, v_uid)
  returning id into v_id;

  insert into public.report_events (report_id, event_type, session_id)
  values (coalesce(p_report_id, (select rp.report_id from public.incident_messages rp where rp.id = p_message_id)),
          'MODERATION_CHANGED', v_uid);

  return jsonb_build_object('flag_id', v_id, 'status', 'OPEN');
end;
$$;

revoke execute on function public.flag_content(text, uuid, uuid, text, text) from public;
grant execute on function public.flag_content(text, uuid, uuid, text, text) to anon, authenticated;