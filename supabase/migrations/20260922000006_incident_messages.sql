-- ====================================================================
-- CLEAR ROAD — 006: incident messages (ROAD CHAT foundation)
--
-- Temporary chat tied to ONE active report. No DMs, no global chat, no
-- permanent public profiles. When a report closes, its chat stops accepting
-- new user messages (enforced in post_incident_message RPC, and mirrored by
-- src/features/chat/messages.ts).
--
-- Message bodies are length-constrained here AND re-validated in the RPC.
-- ====================================================================

set search_path = public, extensions;

create table public.incident_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  session_id uuid not null references public.anonymous_sessions (id) on delete restrict,
  body text not null,
  moderation_state public.message_moderation_state not null default 'VISIBLE',
  created_at timestamptz not null default now(),
  constraint incident_messages_body_length check (
    char_length(btrim(body)) between 1 and 500
  )
);

-- Chat read path: fetch messages of one report, oldest-first.
create index incident_messages_report_idx on public.incident_messages (report_id, created_at);

alter table public.incident_messages enable row level security;

-- Read-side policy (also used by Realtime in M4): anyone may read VISIBLE
-- messages of a report that is not CLOSED and not yet expired. Closed/STALE
-- incident chats drop out of the live product automatically.
create policy "incident_messages_select_visible_open"
  on public.incident_messages
  for select
  to anon, authenticated
  using (
    moderation_state = 'VISIBLE'
    and exists (
      select 1
      from public.reports r
      where r.id = report_id
        and r.lifecycle not in ('CLOSED')
        and r.expires_at > now()
    )
  );

-- Inserts are ONLY allowed via post_incident_message (security definer),
-- which validates session validity, report openness and body length.

comment on table public.incident_messages is
  'Temporary road-chat messages for an active report. Insert via RPC only.';