-- ====================================================================
-- CLEAR ROAD — 014: RPC active_reports
--
-- The map's primary read path. Returns only live (non-closed, non-expired)
-- reports within a radius of a query point, plus their community aggregates.
-- No session linkage is ever exposed: the reporting identity is reduced to a
-- cosmetic label; corroborators are counted, never listed.
--
-- Radius is kilometres. No input lat/lng validation: out-of-range points
-- simply match nothing (st_dwithin returns no rows), which is safe and
-- cheap. Real users report via create_report(), which DOES validate.
-- ====================================================================

set search_path = public, extensions;

create or replace function public.active_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 3
)
returns table (
  id uuid,
  category public.report_category,
  location jsonb,
  note text,
  lifecycle public.report_lifecycle,
  confidence public.report_confidence,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  activator_label text,
  still_dey integer,
  don_clear integer,
  participant_count integer,
  message_count integer
)
language sql
security definer
stable
set search_path = public, extensions
as $$
  with base as (
    select r.*
    from public.reports r
    where r.lifecycle not in ('CLOSED')
      and r.expires_at > now()
      and st_dwithin(r.location, st_point(p_lng, p_lat)::geography, p_radius_km * 1000)
  )
  select
    r.id,
    r.category,
    jsonb_build_object(
      'lat', st_y(r.location::geometry),
      'lng', st_x(r.location::geometry)
    ) as location,
    r.note,
    r.lifecycle,
    r.confidence,
    r.created_at,
    r.updated_at,
    r.expires_at,
    s.label as activator_label,
    coalesce(agg.still_dey, 0)::integer as still_dey,
    coalesce(agg.don_clear, 0)::integer as don_clear,
    coalesce(agg.participant_count, 0)::integer as participant_count,
    coalesce(msg.message_count, 0)::integer as message_count
  from base r
  join public.anonymous_sessions s on s.id = r.session_id
  left join lateral (
    select
      count(*) filter (where c.signal = 'STILL_DEY') as still_dey,
      count(*) filter (where c.signal = 'DON_CLEAR') as don_clear,
      count(distinct c.session_id) as participant_count
    from public.report_confirmations c
    where c.report_id = r.id
  ) agg on true
  left join lateral (
    select count(*) as message_count
    from public.incident_messages m
    where m.report_id = r.id
      and m.moderation_state = 'VISIBLE'
  ) msg on true
  order by r.expires_at asc;
$$;

revoke execute on function public.active_reports(double precision, double precision, double precision) from public;
grant execute on function public.active_reports(double precision, double precision, double precision) to anon, authenticated;