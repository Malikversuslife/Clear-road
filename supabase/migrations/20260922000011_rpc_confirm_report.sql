-- ====================================================================
-- CLEAR ROAD — 011: RPC confirm_report
--
-- STILL_DEY / DON_CLEAR signal. Serialises against races with row locks,
-- rejects self-confirmation, duplicates, closed and expired reports.
-- Mirrors src/features/confirmations/confirmations.ts.
--
-- Custom error codes (raised by XML code in this function and callees):
--   CR001 no anonymous session
--   CR002 session expired / report closed or expired
--   CR003 cannot confirm your own report
--   CR004 duplicate signal
-- ====================================================================

set search_path = public, extensions;

create or replace function public.confirm_report(
  p_report_id uuid,
  p_signal text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_signal public.confirmation_signal;
  v_r public.reports%rowtype;
  v_session_ok boolean;
  v_dup boolean;
  v_still_count integer;
  v_new_confidence public.report_confidence;
  v_exp timestamptz;
  v_transition varchar;
  v_cfg public.lifecycle_policy_config%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  begin
    v_signal := p_signal::public.confirmation_signal;
  exception when invalid_text_representation then
    raise exception 'invalid signal' using errcode = '22023';
  end;

  -- Blocks racing confirmations on the same report and serialises the write.
  select * into v_r
    from public.reports r
   where r.id = p_report_id
   for update;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if v_r.closed_at is not null or v_r.lifecycle = 'CLOSED' then
    raise exception 'report is closed' using errcode = 'CR002';
  end if;

  if v_r.expires_at <= now() then
    raise exception 'report is expired' using errcode = 'CR002';
  end if;

  -- A user can never confirm their own report.
  if v_r.session_id = v_uid then
    raise exception 'cannot confirm your own report' using errcode = 'CR003';
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

  select exists (
    select 1
    from public.report_confirmations
    where report_id = p_report_id and session_id = v_uid
  ) into v_dup;

  if v_dup then
    raise exception 'already signalled this report' using errcode = 'CR004';
  end if;

  select * into v_cfg
    from public.lifecycle_policy_config
   where id = true;

  insert into public.report_confirmations (report_id, session_id, signal)
  values (p_report_id, v_uid, v_signal);

  if v_signal = 'DON_CLEAR' then
    -- Threshold reached → close always. Reopen on later STILL_DEY is a
    -- conscious M0B choice; it stays visible in the event log either way.
    if (
      select count(*) from public.report_confirmations
       where report_id = p_report_id and signal = 'DON_CLEAR'
    ) >= v_cfg.don_clear_close_threshold then
      update public.reports
         set lifecycle = 'CLOSED', closed_at = now()
       where id = p_report_id;
      insert into public.report_events (report_id, event_type, session_id, payload)
      values (p_report_id, 'DON_CLEAR_ADDED', v_uid, '{}'::jsonb);
      insert into public.report_events (report_id, event_type, session_id, payload)
      values (p_report_id, 'REPORT_CLOSED', v_uid,
              jsonb_build_object('reason', 'DON_CLEAR'));
      return public.report_public_json(p_report_id);
    end if;
  end if;

  -- STILL_DEY path: refresh lifecycle + recompute derived data.
  select count(*) into v_still_count
    from public.report_confirmations
   where report_id = p_report_id and signal = 'STILL_DEY';

  v_exp := public.effective_expiry(v_r.category::text, v_r.created_at, v_still_count);
  v_new_confidence := public.confidence_from_count(v_still_count);

  update public.reports
     set expires_at = v_exp,
         confidence = v_new_confidence,
         last_confirmed_at = now(),
         lifecycle = 'ACTIVE'
   where id = p_report_id;

  insert into public.report_events (report_id, event_type, session_id, payload)
  values (p_report_id,
          case when v_signal = 'STILL_DEY' then 'CONFIRMATION_ADDED'::public.report_event_type
               else 'DON_CLEAR_ADDED'::public.report_event_type end,
          v_uid,
          jsonb_build_object('signal', v_signal,
                             'confidence', v_new_confidence));

  return public.report_public_json(p_report_id);
end;
$$;

revoke execute on function public.confirm_report(uuid, text) from public;
grant execute on function public.confirm_report(uuid, text) to anon, authenticated;