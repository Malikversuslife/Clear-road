# CLEAR ROAD — Milestones

## M0B — Technical foundation (current)

**Status: complete.** Everything below is verified locally; SQL requires live-Supabase
verification (see `DATA_MODEL.md` checklist and `ARCHITECTURE.md`).

- Codebase scaffold: Next.js 16 App Router + TypeScript + Tailwind v4 + ESLint +
  Prettier, on `master` (no commits yet).
- Supabase wiring: anonymous auth client, server client, service-role admin client.
- 17 SQL migrations (enums → policy config → sessions → reports → confirmations →
  messages → flags → events → security helpers → RPCs → maintenance → realtime guard).
- Domain engine (pure TS): lifecycle/expiry, confidence, validation, coordinates,
  confirmations, chat, moderation, sessions — 81 Vitest tests passing.
- Docs: product foundation, architecture, data model, privacy & trust, milestones.

### M0B quality gates (all local, all green)

`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test` (81/81),
`npm run build`.

## M1 — Foundation UI (planned)

- Wire the RPCs to a real Supabase project; apply + verify all migrations live.
- Map-based report feed around `get_active_reports` (Lagos region focus).
- Create-report flow with live anonymous session bootstrap and validation errors
  surfaced from `validation.ts` and the RPC `22023`/`CR*` codes.
- Report detail (lifecycle + confidence badges, still-dey/don-clear actions, chat).
- Flags (report/message) with curated reasons surfaced from `flags.ts`.

## M2 — Lifecycle & safety

- First responder / official escalation paths; `report_events` replay surface.
- Automated STALE/DON_CLEAR closures surfaced through realtime push.

## M3 — Auth & trust (optional, product-led)

- Graded anonymous → optional lightweight identity if trust data demands it.
- Reputation/trust heuristics on top of confirmation graph (still exploratory).

## M4 — Scale & ops

- Maintenance jobs: `run_lifecycle_pass`, `purge_expired_sessions`, analytics.
- Rate limiting, abuse dashboards, observability.

## M5 — Solar & geodata hardening

- Real sunrise service by location/date behind the already-injected `SunriseResolver`
  (replace `fixedClockSunriseResolver`).
- Heatmaps, isochrones, routing-oriented projections.

## Notes

- Spy project ordering: the SQL is written to be applied as a single ordered batch;
  nothing must be hand-patched after the fact.
- This file and the other docs are living documentation — update them in the same PR
  as the behaviour they describe.
