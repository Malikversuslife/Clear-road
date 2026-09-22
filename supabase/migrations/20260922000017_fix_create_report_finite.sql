-- ====================================================================
-- CLEAR ROAD — 017: fix create_report finite-number validation
--
-- ROOT CAUSE discovered during M0B.5 live verification:
--   `isfinite(double precision)` does not exist in PostgreSQL (isfinite
--   only accepts date/timestamp/timestamptz/interval). The original
--   00010 body compiled at CREATE time (plpgsql defers body validation
--   to first call) but threw "function isfinite(double precision) does
--   not exist" (SQLSTATE 42883) on every invocation.
--
-- FIX: replace with a bounded float check that is FALSE for NaN and for
-- +/-Infinity — matching Number.isFinite() in src/features/geo/coordinates.ts.
--
-- This migration re-creates the same function so environments that already
-- applied the original 00010 (the linked M0B.5 project) receive the fix
-- without rewriting applied history. 00010 itself is also corrected for
-- fresh environments; both definitions are identical, so applying 00017
-- on top of a corrected 00010 is a no-op (idempotent).
-- ====================================================================

set search_path = public, extensions;

create or replace function public.create_report(
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_cat public.report_category;
  v_note text;
  v_expires_at timestamptz;
  v_id uuid;
  v_active boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = '28000', hint = 'Call get_my_session() first.';
  end if;

  begin
    v_cat := p_category::public.report_category;
  exception when invalid_text_representation then
    raise exception 'invalid category'
      using errcode = '22023';
  end;

  -- Float finite check: Postgres has no isfinite(double precision). The
  -- bounded comparison is FALSE for NaN and for +/-Infinity, matching
  -- Number.isFinite() in src/features/geo/coordinates.ts.
  if not (p_lat > -'Infinity'::float8 and p_lat < 'Infinity'::float8) or
     not (p_lng > -'Infinity'::float8 and p_lng < 'Infinity'::float8) then
    raise exception 'coordinates must be finite numbers'
      using errcode = '22023';
  end if;

  if p_lat < -90 or p_lat > 90 then
    raise exception 'latitude out of range'
      using errcode = '22023';
  end if;

  if p_lng < -180 or p_lng > 180 then
    raise exception 'longitude out of range'
      using errcode = '22023';
  end if;

  -- Reject the "null island" — a real, common client bug that would pollute
  -- every viewport query with a phantom point in the Gulf of Guinea.
  if p_lat = 0 and p_lng = 0 then
    raise exception 'null-island coordinates rejected'
      using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'note exceeds 280 characters'
      using errcode = '22023';
  end if;

  select (expires_at > now())
    into v_active
    from public.anonymous_sessions
   where id = v_uid;

  if not found then
    raise exception 'no anonymous session' using errcode = 'CR001';
  end if;

  if not v_active then
    raise exception 'session expired' using errcode = 'CR002';
  end if;

  v_expires_at := public.effective_expiry(v_cat::text, now(), 0);

  insert into public.reports (category, location, note, session_id, expires_at)
  values (
    v_cat,
    st_point(p_lng, p_lat)::geography,
    v_note,
    v_uid,
    v_expires_at
  )
  returning id into v_id;

  perform public.refresh_lifecycle(v_id);

  insert into public.report_events (report_id, event_type, session_id, payload)
  values (v_id, 'REPORT_CREATED', v_uid,
          jsonb_build_object('category', v_cat));

  return public.report_public_json(v_id);
end;
$$;

revoke execute on function public.create_report(text, double precision, double precision, text) from public;
grant execute on function public.create_report(text, double precision, double precision, text) to anon, authenticated;
grant execute on function public.get_my_session() to anon, authenticated;