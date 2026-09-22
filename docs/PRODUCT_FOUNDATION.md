# CLEAR ROAD — Product Foundation

## Product

CLEAR ROAD is a mobile-first, crowdsourced road-awareness product for Lagos, Nigeria.
Drivers share and corroborate road conditions in real time — "still dey" (traffic/jam
ahead), "don clear" (it has cleared), police checkpoints, accidents, hazards — and read
a live picture of conditions ahead before they leave.

Core values:

- **Ephemerality over archives.** Conditions change fast. Reports exist to answer one
  question: _what is ahead right now?_ They expire, decay, and auto-close so the live
  map reflects the present, not history.
- **Truth by corroboration.** One driver's signal is a claim; two or more independent,
  unaffiliated people saying the same thing are evidence. Confidence is derived from
  corroboration, never from a single voice.
- **Trust through peer review.** Anyone can flag bad reports, bad messages, and abuse.
  Moderation evidence feeds visible lifecycle decisions (moderated content is closed),
  keeping the signal clean without a large central team.
- **Privacy by default.** No accounts, no signup. Reporting is fully anonymous and keys
  everything off an ephemeral anonymous session. No profile, no cross-device identity.

## Scope of this milestone (M0B)

M0B builds the **technical foundation only**: the schema, security posture, lifecycle
engine, validation layer, and the tests that pin the behaviour down — all the stuff M1+
needs to stand on. No UI, no live integration, no deployment.

Deliverables:

1. Next.js App Router codebase with Supabase (anonymous auth + PostGIS) wired in.
2. Full SQL schema (17 migrations): enums, tables, RLS, security-definer RPCs,
   maintenance functions, realtime guard.
3. Domain logic as pure, tested TypeScript modules (the reference implementation the
   SQL mirrors): lifecycle/expiry, confidence, validation, coordinates,
   confirmations, chat, moderation flags, anonymous sessions.
4. Vitest suite (81 tests) pinning the behaviour of all domain logic.
5. Documentation of the product contract, data model, security posture, and roadmap.

## Language & terminology

Nigerian Pidgin terms are product vocabulary:

- **STILL_DEY** — "it is still there." A driver confirms the condition/report still exists.
- **DON_CLEAR** — "it has cleared." A driver indicates the reported condition is gone.
  Meeting the don-clear threshold closes the report.

See `docs/MILESTONES.md` for the phased roadmap and `src/types/index.ts` for the
canonical type definitions.
