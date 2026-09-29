-- Anonymous sign-in uses authenticated; the unsigned anon role needs reads only.
revoke execute on function public.get_my_session() from public, anon;
revoke execute on function public.create_report(text, double precision, double precision, text) from public, anon;
revoke execute on function public.confirm_report(uuid, text) from public, anon;
revoke execute on function public.post_incident_message(uuid, text) from public, anon;
revoke execute on function public.flag_content(text, uuid, uuid, text, text) from public, anon;

-- Browser roles do not manage tables. In particular, RLS does not cover TRUNCATE.
-- Explicit list avoids changing extension-owned or future unrelated tables.
revoke truncate, references, trigger on table
  public.anonymous_sessions, public.reports, public.report_confirmations,
  public.incident_messages, public.moderation_flags, public.report_events
from public, anon, authenticated;
