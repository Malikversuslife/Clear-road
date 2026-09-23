# CLEAR ROAD — Milestones

## M0B — Technical foundation

**Status: complete.** Codebase scaffold, Supabase wiring, 17 SQL migrations,
pure domain engine (lifecycle, confidence, validation, coordinates,
confirmations, chat, moderation, sessions), docs, and the 81-test harness.
Local gates green; live-Supabase SQL verification still pending (see
`DATA_MODEL.md` checklist and `ARCHITECTURE.md`).

## M1 — Live Lagos night map (current)

**Status: complete.** The landing page is now a live, privacy-first Lagos map.

- **MapLibre GL JS** is the only map library (`maplibre-gl`, installed). It is
  loaded strictly client-side via `next/dynamic(..., { ssr: false })`; the `/`
  route still prerenders as static content (verified in `next build`).
- **Night tiles** come from OpenFreeMap's keyless `dark` vector style backed by
  OpenMapTiles data, behind a `TileProvider` seam. This is an honest
  **development** source — see `ARCHITECTURE.md` for the swap path and licence
  caveat.
- **Locate control is explicit + ephemeral by construction** (code + tests):
  nothing runs on mount/focus/visibilitychange; a fix is requested only by a
  button press; it lives in React memory only (no localStorage,
  sessionStorage, cookies, or Supabase write); one discrete `getCurrentPosition`
  (never `watchPosition`). Denied/unavailable are first-class honest states and
  never block the map.
- **Design tokens** (Tailwind v4 `@theme`): Lagos-night palette (`night`,
  `surface`, `ink`, `lime`, `coral`, `cream`) + retro-computer font pairing.
- **Domain pieces**: `src/features/map/config.ts` (pure), `locate.ts` (pure
  reducer), `use-geolocation.ts` (browser hook), `map-view.tsx` (MapLibre
  surface with a no-blank-screen failure contract), `map-shell.tsx` (SSR-safe
  host + locate control).

### M1 quality gates (all local, all green)

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`
(101/101, 10 files), `npm run build`.

## M2 — Map-driven reporting (planned, NOT started)

The original "Foundation UI" scope moves here so M1 could ship cleanly:

- Wire the RPCs to a live Supabase project; apply + verify all migrations live.
- Map-based report feed around `get_active_reports` (Lagos region focus).
- Create-report flow with live anonymous session bootstrap and validation errors
  surfaced from `validation.ts` and the RPC `22023`/`CR*` codes.
- Report detail (lifecycle + confidence badges, still-dey/don-clear actions, chat).
- Flags (report/message) with curated reasons surfaced from `flags.ts`.

## M3 — Lifecycle & safety

- First responder / official escalation paths; `report_events` replay surface.
- Automated STALE/DON_CLEAR closures surfaced through realtime push.

## M4 — Auth & trust (optional, product-led)

- Graded anonymous → optional lightweight identity if trust data demands it.
- Reputation/trust heuristics on top of confirmation graph (still exploratory).

## M5 — Scale & ops

- Maintenance jobs: `run_lifecycle_pass`, `purge_expired_sessions`, analytics.
- Rate limiting, abuse dashboards, observability.

## M6 — Solar & geodata hardening

- Real sunrise service by location/date behind the already-injected `SunriseResolver`
  (replace `fixedClockSunriseResolver`).
- Heatmaps, isochrones, routing-oriented projections.

## Notes

- Spy project ordering: the SQL is written to be applied as a single ordered batch;
  nothing must be hand-patched after the fact.
- This file and the other docs are living documentation — update them in the same PR
  as the behaviour they describe.
- Current status at a glance: **M0B done, M1 done, M2..M6 not started.**
