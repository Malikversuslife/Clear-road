# CLEAR ROAD — Architecture

## Runtime shape

- **Next.js 16 App Router** (Turbopack, TypeScript). M1 ships the `/` route as a
  live Lagos night map (client-only MapLibre surface under an SSR-safe shell).
- **Supabase** (Postgres + PostGIS + auth + storage) as the backend. The browser talks
  to Supabase **only through security-definer RPC functions**, never directly to base
  tables. Realtime is enabled by migration `00016` and guarded so unauthenticated
  clients never see anything they could not query themselves.
- **Anonymous auth.** Every visitor gets a Supabase anonymous in-app user; `auth.uid()`
  is the session key. This is the entire identity model — no accounts.

## Map feature (`src/features/map/`)

The live map is a small, deliberately layered module. Only MapLibre GL JS is used
(it is the app's only map library), and it loads strictly in the browser.

| File                             | Role                                                                                  | SSR?   |
| -------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| `config.ts`                      | Pure constants: Lagos centre/default viewport, `TileProvider` seam, style builder     | safe   |
| `locate.ts`                      | Pure locate state machine (reducer: idle → requesting → available/denied/unavailable) | safe   |
| `use-geolocation.ts`             | Browser hook: one discrete `getCurrentPosition`, ephemeral, button-only               | client |
| `map-view.tsx`                   | MapLibre surface with a no-blank-screen failure panel + retry                         | client |
| `map-shell.tsx`                  | SSR-safe host (dynamic `ssr:false`) + locate control overlay                          | client |
| `../sightings/`                  | Sanitized active-report client, signal markers, report flow, and pure display helpers | mixed  |
| `../components/bottom-sheet.tsx` | Reusable terminal-drawer surface for nearby, detail, and report states                | client |

### Tile provider seam

The default vector source is OpenFreeMap's keyless `dark` style backed by
OpenMapTiles data. This is an honest **development** choice: it is a public
fair-use instance, not a production SLA. The seam to swap is one place:
`DEFAULT_TILE_PROVIDER` in `config.ts`, or feeding a different provider into
`createClearRoadStyle(provider)`. Attribution is never stripped.

### Locate privacy contract (enforced in code + tests)

- **Explicit action only** — the locate button press is the sole trigger; nothing
  runs on mount / focus / visibilitychange and nothing auto-starts.
- **Ephemeral** — a fix lives in reducer/React memory only; no localStorage,
  sessionStorage, cookies, or Supabase write. Never `watchPosition`.
- **First-class failure** — `denied` / `unavailable` are honest UI states; the map
  stays fully usable and never becomes the hostage of a permission screen.
- The reducer itself rejects `succeed`/`fail` unless a request is actually in
  flight, so a stale callback can never inject a fix into a denied/unavailable state.

### M2 sightings contract

Sightings use the existing security-definer RPCs only: `active_reports` reads a
bounded radius around the visible map center, `get_my_session` establishes the
temporary anonymous session, and `create_report` performs server-side category,
coordinate, note, lifecycle, and confidence enforcement. The browser maps only
the sanitized public response; it never receives reporter UUIDs, session IDs,
moderation internals, or service-role data.

Viewport reads are debounced and stale responses are discarded. Map movement is
not written to Supabase, no GPS watcher is used, and M2 does not subscribe to
realtime reports. Report location is deliberately selected on the map and is
not silently replaced by the user's device location.

## Layers

```
browser
  │  Supabase client (anon role)
  ▼
RPC functions (security definer, SECURITY INVOKER, search_path fixed)
  │  RLS enforced per-statement for NON-definer access
  ▼
base tables + PostGIS geography(Point, 4326)
```

The Supabase anonymous role gets bare `usage` on the `extensions` (PostGIS/pgcrypto)
schema and `execute` on the public RPCs — and nothing else. Base tables have **no**
anonymous SELECT/INSERT/UPDATE policies (RLS is `on` with no permissive policies),
so even a raw client-side query would see the empty set. All access goes through RPCs.

## Client factories (`src/lib/supabase/`)

- `client.ts` — browser client for interactive users (anonymous session persisted via
  `@supabase/ssr` in the next dev cookie jar).
- `server.ts` — server-side client bound to the request cookie jar (RSC/route handlers).
- `admin.ts` — **service-role** admin client, imported under `server-only`. Guarded by
  `assertAdminEnv()`; used by maintenance/jobs only. Never ship it to the browser.

## Domain modules (reference implementation)

Pure, dependency-free TypeScript under `src/features/` — the SQL RPCs mirror these
rules, and these modules are the source of truth for expected behaviour:

| Modules                          | Responsibility                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `reports/lifecycle.ts`           | Time-based lifecycle + expiry engine, sunrise-aware overnight policy, `isVisibleLive` |
| `reports/confidence.ts`          | Evidence-based confidence (UNCONFIRMED → HIGH) from independent STILL_DEY count       |
| `reports/validation.ts`          | Client-side `validateCreateReport` schema (category, location, note)                  |
| `reports/categories.ts`          | Allowed categories and their lifecycle/overnight semantics                            |
| `geo/coordinates.ts`             | Lat/lng/nearby schemas, decimal precision caps, (0,0) island rejection                |
| `confirmations/confirmations.ts` | STILL_DEY/DON_CLEAR signal rules and thresholds                                       |
| `chat/messages.ts`               | Incident-message validation + visibility rules                                        |
| `moderation/flags.ts`            | Flag-payload validation (exactly one target, one allowed reason)                      |
| `anon-sessions/session.ts`       | Anonymous session label policy (`^ANON [0-9]{2}$`), expiry                            |

`src/types/database.ts` holds hand-maintained DB row types mirroring the migrations.
When a live Supabase project is available, `supabase gen types typescript` output
replaces this file (see note at the top of that file).

## Synchronisation contract

SQL and TS are written in parallel as two implementations of the same contract.
Rules to keep them in sync:

- Policy _constants_ (timings, thresholds) live in `lifecycle.ts` and are copied into
  the `lifecycle_policy_config` seed row (`00002`) and used by `00009`/`00014`.
- Changing behaviour requires updating **both** the module and its SQL mirror, plus
  the tests. The docs (`DATA_MODEL.md`) record the contract so the two can be checked
  against each other.
- The SQL cannot be executed in this environment (no Postgres/Supabase CLI); every
  migration is written to apply cleanly top-down but must be verified against a live
  Supabase project (see final verification checklist in `MILESTONES.md`).

## Error-code contract

`28000` — not authenticated; `22023` — invalid input; `P0002` — not found;
`CR001` — no active session; `CR002` — session expired / report closed or expired;
`CR003` — self-confirmation; `CR004` — duplicate signal.
