# CLEAR ROAD — Data Model

Migrations live in `supabase/migrations/`, prefixed `20260922` and numbered `00000`–`00016`.
They apply in order. All start with `set search_path = public, extensions;`.

## Schema layout

- `extensions` schema holds PostGIS (`postgis`) and crypto (`pgcrypto`); `anon`,
  `authenticated`, `service_role` get `usage` on it.
- Application tables live in `public`.

## Enums (`00001`)

- `report_category` — accident, road_works, checkpoint_roadblock, police_presence,
  heavy_traffic, hazard, other.
- `report_lifecycle` — NEW, ACTIVE, RECENT, STALE, CLOSED (time-based, separate from confidence).
- `report_confidence` — UNCONFIRMED, LOW, MEDIUM, HIGH.
- `report_close_reason` — DON_CLEAR, EXPIRED, MODERATED.
- `confirmation_signal` — STILL_DEY, DON_CLEAR.
- `report_event_type` — REPORTED, CONFIRMED, CLOSED, REOPENED, MODERATION_CHANGED, MESSAGE_POSTED.
- `message_moderation_state`, `moderation_status`, `moderation_target`.

## Tables

### `lifecycle_policy_config` (`00002`)

Single-row config with CHECK `id = 1`. Seed values:
initial 45 min, extension 15 min, max confirmations counted 4, max lifetime 3 h,
stale_after 15 min, stale_grace 30 min, new_window 5 min, overnight start 18:00,
don-clear threshold 1. (Mirrors `DEFAULT_LIFECYCLE_POLICY` in
`src/features/reports/lifecycle.ts`.)

### `anonymous_sessions` (`00003`)

- `id` uuid PK (the Supabase anonymous `auth.uid()` is stored in `auth_user_id` unique).
- `label` CHECK `^ANON [0-9]{2}$` (10–99, generated server-side, cosmetic, not unique).
- `expires_at`; RLS: owner-only select (private `get_my_session`).

### `reports` (`00004`)

- `location` `geography(Point, 4326)` NOT NULL, GiST index, PostGIS validity check
  (rejects real-world 0,0). `note` ≤ 280, blank→null.
- `lifecycle`/`confidence` columns plus `expires_at`, `last_confirmed_at`, `closed_at`,
  `created_at`/`updated_at` (trigger-maintained). Constraints cap lifetime.
- RLS is ON with **no** direct policies (RPC-only).

### `report_confirmations` (`00005`)

- `signal` (`STILL_DEY`/`DON_CLEAR`), `UNIQUE(report_id, session_id)` — one vote per
  person per report; self-confirmation blocked in the confirm RPC.

### `incident_messages` (`00006`)

- Body 1–500; `moderation_state`; RLS read policy: only VISIBLE messages on reports
  that are live (not closed, not expired). Realtime read via `00016`.

### `moderation_flags` (`00007`)

- Exactly-one-target CHECK: either a report or a message is the target (not both).
- `reason` single allowed among the curated set; `note` optional.

### `report_events` (`00008`)

- Append-only chronological stream of everything that happened to a report
  (created, confirmed, closed, reopened, moderated, message posted).

## RPC surface (`00010`–`00015`)

All security definer with `search_path` fixed to `public, extensions`; low-level
helpers from `00009` are executed by them (and PUBLIC execute is revoked on those
helpers).

- `create_report(category, lat, lng, note)` — validates category/coords/note/session,
  inserts report + REPORTED event. Rows the session's anonymous label as activator.
- `confirm_report(report_id, signal)` — row lock, guards: no session (CR001),
  expired/closed (CR002), self-confirm (CR003), duplicate (CR004). Applies
  DON_CLEAR close at threshold, updates lifecycle/expiry.
- `post_incident_message(report_id, body)` / `get_incident_messages(report_id)` — chat
  with MESSAGE_POSTED events; read only returns visible messages on live reports.
- `flag_content(...)` — writes a moderation flag; fires MODERATION_CHANGED event.
- `get_active_reports(lat, lng, radius_m)` — radius query with lateral aggregate counts
  (still_dey, don_clear, participants, message count) + activator label + computed
  lifecycle/expiry.
- `run_lifecycle_pass(into_report_future_min, max_reports)` and
  `purge_expired_sessions` (`00015`) — maintenance, service_role only; implement the
  STALE→CLOSED(EXPIRED) auto-close and session pruning.

## Realtime (`00016`)

Guarded: adds `reports`/`incident_messages` to the `supabase_realtime` publication only
if not present. `incident_messages` select policy already restricts leaked rows to live
reports' visible messages; `reports` has no anon SELECT so realtime leaks nothing.

## Verification checklist (live Supabase, after M0B)

1. Apply `00000`→`00016` in order; confirm no errors.
2. `select * from lifecycle_policy_config;` → seed row 1 present.
3. As anon: `get_my_session()` creates a session; label matches `^ANON [0-9]{2}$`.
4. anon direct `select * from reports;` → empty set (RLS), while RPC works.
5. Create/confirm/flag/message round-trips through the RPCs; assert CR error codes.
6. `run_lifecycle_pass` closes a synthetic stale report with EXPIRED; DON_CLEAR
   threshold closes with DON_CLEAR.
7. Radius query returns point geometry within radius and correct aggregate counts.
