# CLEAR ROAD

SEE WHAT'S AHEAD. Crowdsourced road awareness for Lagos.

## What this is

CLEAR ROAD is a mobile-first product where drivers share and corroborate road
conditions in real time — accidents, checkpoints, traffic jams, "still dey / don
clear" — then read a live picture of what's ahead. It's fully anonymous: no accounts,
no signup, ephemeral reports, truth by corroboration, and peer review through flags.

This repository is at **M0B — technical foundation**: the Next.js + Supabase app shell,
the full database schema and security posture, the domain engine, and its tests.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Supabase: Postgres + PostGIS (`geography(Point, 4326)`) + anonymous auth, all access
  via security-definer RPCs under RLS
- Vitest for domain logic tests
- Tailwind CSS v4, ESLint, Prettier

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. M0B ships a single landing page; feature routes arrive in M1.

The Supabase path requires a live project and env vars — see `.env.example`.

## Quality gates

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # Vitest (81 tests)
npm run build          # production build
```

## Project layout

- `supabase/migrations/` — ordered SQL migrations (enums → schema → RLS → RPCs).
- `src/features/` — pure domain logic (lifecycle, confidence, validation, chat,
  moderation, sessions, geo) with `.test.ts` files.
- `src/lib/supabase/` — browser, server, and service-role admin clients.
- `src/types/` — shared types; `database.ts` mirrors the SQL while no live project
  exists for `supabase gen types`.

## Documentation

- `docs/PRODUCT_FOUNDATION.md` — product, values, scope
- `docs/ARCHITECTURE.md` — layers, clients, domain modules, sync contract
- `docs/DATA_MODEL.md` — tables, enums, RPCs, live-verification checklist
- `docs/PRIVACY_AND_TRUST.md` — anonymity, confidence, moderation, trade-offs
- `docs/MILESTONES.md` — M0B status and roadmap
