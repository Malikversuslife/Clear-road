-- ====================================================================
-- CLEAR ROAD — 009: security helper functions
--
-- These helpers are the DATABASE side of the lifecycle/expiry/confidence
-- engine. The reference implementation and its tests live in
-- src/features/reports/*.ts; the SQL below mirrors that policy so the
-- database can enforce it at write time. When tuning policy, update the
-- lifecycle_policy_config row AND src/features/reports/lifecycle.ts together.
--
-- Functions are SECURITY DEFINER: they run as the schema owner for the
-- duration of their call, bypassing RLS. That is fine ONLY because every
-- function keys its writes off auth.uid() and validates its inputs. They are
-- the controlled mutation surface for browser clients.
-- ====================================================================

set search_path = public, extensions;

-- ------------------------------------------------------------------
-- Cosmetic display label. Server-side only — the client never supplies it.
-- ------------------------------------------------------------------
create or replace function public.generate_anon_label()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select 'ANON ' || (10 + floor(random() * 90))::int::text;
$$;

-- ------------------------------------------------------------------
-- Placeholder sunrise (UTC 06:00 of the UTC day). M5 replaces this with a
-- location/date aware service. The TS engine already accepts an injected
-- resolver; this SQL helper is deliberately simple and documented.
-- ------------------------------------------------------------------
create or replace function public.placeholder_sunrise(p_instant timestamptz)
returns timestamptz
language sql
immutable
set search_path = public, extensions
as $$
  select date_trunc('day', p_instant) + interval '6 hours';
$$;

-- ------------------------------------------------------------------
-- Effective expiry mirror of computeExpiry() in src/features/reports/lifecycle.ts
-- ------------------------------------------------------------------
create or replace function public.effective_expiry(
  p_category text,
  p_created_at timestamptz,
  p_confirmations integer default 0
)
returns timestamptz
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_cat public.report_category;
  v_cfg public.lifecycle_policy_config%rowtype;
  v_base_lifetime interval;
  v_base timestamptz;
  v_sunrise timestamptz;
  v_next_sunrise timestamptz;
  v_nightfall timestamptz;
begin
  select * into v_cfg
    from public.lifecycle_policy_config
   where id = true;

  v_cat := p_category::public.report_category;

  v_base_lifetime :=
      v_cfg.initial_lifetime
    + v_cfg.confirmation_extension * least(p_confirmations, v_cfg.max_confirmations_counted);
  v_base_lifetime := least(v_base_lifetime, v_cfg.max_lifetime);

  v_base := p_created_at + v_base_lifetime;

  if v_cat not in ('police_presence', 'checkpoint_roadblock') then
    return v_base;
  end if;

  v_sunrise      := public.placeholder_sunrise(p_created_at);
  v_next_sunrise := public.placeholder_sunrise(p_created_at + interval '1 day');
  v_nightfall    := date_trunc('day', p_created_at) + interval '18 hours';

  if p_created_at < v_sunrise then
    -- Pre-dawn reports reset at this morning's sunrise.
    return greatest(v_base, v_sunrise);
  elsif p_created_at >= v_nightfall then
    -- Created in the evening: survives overnight until the next sunrise.
    return greatest(v_base, v_next_sunrise);
  else
    -- Created during the day: extend only if it would still be alive at nightfall.
    if v_base > v_nightfall then
      return greatest(v_base, v_next_sunrise);
    end if;
    return v_base;
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Confidence mirror of computeConfidence() in src/features/reports/confidence.ts
-- ------------------------------------------------------------------
create or replace function public.confidence_from_count(p_count integer)
returns public.report_confidence
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_cfg public.lifecycle_policy_config%rowtype;
begin
  select * into v_cfg
    from public.lifecycle_policy_config
   where id = true;

  if p_count >= v_cfg.confidence_high_threshold then
    return 'HIGH';
  elsif p_count >= v_cfg.confidence_medium_threshold then
    return 'MEDIUM';
  elsif p_count >= v_cfg.confidence_low_threshold then
    return 'LOW';
  end if;
  return 'UNCONFIRMED';
end;
$$;

-- ------------------------------------------------------------------
-- Lifecycle refresh mirror of computeLifecycle(). Recomputed materialised
-- columns on reports so queries never re-derive logic ad hoc.
-- ------------------------------------------------------------------
create or replace function public.refresh_lifecycle(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_r public.reports%rowtype;
  v_cfg public.lifecycle_policy_config%rowtype;
  v_still integer;
  v_last_conf timestamptz;
  v_exp timestamptz;
  v_new public.report_lifecycle;
  v_now timestamptz := now();
  v_previous public.report_lifecycle;
begin
  select * into v_r from public.reports where id = p_report_id;
  if not found then
    return;
  end if;

  v_previous := v_r.lifecycle;

  if v_r.closed_at is not null then
    if v_r.lifecycle <> 'CLOSED' then
      update public.reports set lifecycle = 'CLOSED' where id = p_report_id;
    end if;
    return;
  end if;

  select count(*) into v_still
    from public.report_confirmations
   where report_id = p_report_id and signal = 'STILL_DEY';

  select max(created_at) into v_last_conf
    from public.report_confirmations
   where report_id = p_report_id and signal = 'STILL_DEY';

  select * into v_cfg
    from public.lifecycle_policy_config
   where id = true;

  v_exp := public.effective_expiry(v_r.category::text, v_r.created_at, v_still);

  if v_now >= v_exp + v_cfg.stale_grace then
    v_new := 'CLOSED';
  elsif v_now >= v_exp then
    v_new := 'STALE';
  elsif v_still > 0 then
    if v_last_conf is not null and v_now >= v_last_conf + v_cfg.stale_after then
      v_new := 'STALE';
    else
      v_new := 'ACTIVE';
    end if;
  else
    if v_now <= v_r.created_at + v_cfg.new_window then
      v_new := 'NEW';
    else
      v_new := 'RECENT';
    end if;
  end if;

  if v_new = v_previous then
    return;
  end if;

  if v_new = 'CLOSED' then
    update public.reports
       set lifecycle = 'CLOSED',
           closed_at = now(),
           expires_at = v_exp
     where id = p_report_id;
    insert into public.report_events (report_id, event_type, session_id, payload)
    values (p_report_id, 'REPORT_CLOSED', null,
            jsonb_build_object('reason', 'EXPIRED'));
  else
    update public.reports
       set lifecycle = v_new,
           expires_at = v_exp,
           last_confirmed_at = v_last_conf
     where id = p_report_id;
    insert into public.report_events (report_id, event_type, session_id, payload)
    values (p_report_id, 'LIFECYCLE_CHANGED', null,
            jsonb_build_object('from', v_previous, 'to', v_new));
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Sanitised public view of one report (no session internals).
-- ------------------------------------------------------------------
create or replace function public.report_public_json(p_report_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', r.id,
    'category', r.category,
    'location', jsonb_build_object(
      'lat', st_y(r.location::geometry),
      'lng', st_x(r.location::geometry)
    ),
    'note', r.note,
    'lifecycle', r.lifecycle,
    'confidence', r.confidence,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'last_confirmed_at', r.last_confirmed_at,
    'expires_at', r.expires_at,
    'closed_at', r.closed_at
  )
  from public.reports r
  where r.id = p_report_id;
$$;

-- ------------------------------------------------------------------
-- Sanitised public view of one incident message (chat identity only).
-- ------------------------------------------------------------------
create or replace function public.incident_message_public_json(p_message_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', m.id,
    'body', m.body,
    'label', s.label,
    'created_at', m.created_at
  )
  from public.incident_messages m
  join public.anonymous_sessions s on s.id = m.session_id
  where m.id = p_message_id;
$$;

-- ------------------------------------------------------------------
-- Get-or-create the calling anonymous session and refresh its lease.
-- The caller can only reach its OWN session (auth.uid()).
-- ------------------------------------------------------------------
create or replace function public.get_my_session()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.anonymous_sessions%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not authenticated');
  end if;

  select * into v_row from public.anonymous_sessions where id = v_uid;

  if not found then
    insert into public.anonymous_sessions (id, label, expires_at)
    values (v_uid, public.generate_anon_label(), now() + interval '24 hours')
    on conflict (id) do nothing;

    select * into v_row from public.anonymous_sessions where id = v_uid;

    return jsonb_build_object(
      'session_id', v_row.id,
      'label', v_row.label,
      'expires_at', v_row.expires_at,
      'is_new', true
    );
  end if;

  -- Renew the activity lease (session aliveness, NOT movement history).
  update public.anonymous_sessions
     set last_seen_at = now(),
         expires_at = greatest(v_row.expires_at, now() + interval '24 hours')
   where id = v_uid;

  select * into v_row from public.anonymous_sessions where id = v_uid;

  return jsonb_build_object(
    'session_id', v_row.id,
    'label', v_row.label,
    'expires_at', v_row.expires_at,
    'is_new', false
  );
end;
$$;

-- Internal helpers are not caller-callable; drop the default PUBLIC grant.
revoke execute on function public.placeholder_sunrise(timestamptz) from public;
revoke execute on function public.effective_expiry(text, timestamptz, integer) from public;
revoke execute on function public.confidence_from_count(integer) from public;
revoke execute on function public.refresh_lifecycle(uuid) from public;
revoke execute on function public.generate_anon_label() from public;