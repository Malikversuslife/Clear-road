# CLEAR ROAD — Architecture

## Runtime shape

- **Next.js 16 App Router** (Turbopack, TypeScript). M0B ships a single static landing
  page; feature routes land in later milestones.
- **Supabase** (Postgres + PostGIS + auth + storage) as the backend. The browser talks
  to Supabase **only through security-definer RPC functions**, never directly to base
  tables. Realtime is enabled by migration `00016` and guarded so unauthenticated
  clients never see anything they could not query themselves.
- **Anonymous auth.** Every visitor gets a Supabase anonymous in-app user; `auth.uid()`
  is the session key. This is the entire identity model — no accounts.

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
