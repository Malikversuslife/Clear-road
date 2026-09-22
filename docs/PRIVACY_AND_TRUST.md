# CLEAR ROAD — Privacy & Trust

## Privacy posture

- **No accounts, ever in M0B/M1 scope.** Identity = Supabase anonymous in-app user
  created silently on first visit. There is no profile, no name, no phone, no
  cross-device identity, no tracking of a person over time.
- **Labels are cosmetic.** "ANON 82" is a friendly, server-generated display label used
  only for chat/attribution within a single live report. It is deliberately **not**
  unique and carries no identity: it is minted randomly (10–99) and reused is fine.
- **Ephemeral data.** Reports, confirmations, messages, sessions all carry short
  lifetimes and are pruned. The product is designed to forget, not to archive.
- **Minimal exposure.** The browser only ever talks to Supabase through security-definer
  RPCs. Base tables are RLS-locked with no permissive policies, so a compromised client
  still cannot enumerate rows directly.
- **Session privacy.** `anonymous_sessions` select policy is owner-only; the low-level
  session helper is not PUBLIC-executable. Labels are deliberately non-unique and never
  joined back to auth identity in any API the client can call.

## Trust posture

Confidence is **evidence, not assertion**:

| Confidence  | Independent STILL_DEY count |
| ----------- | --------------------------- |
| UNCONFIRMED | 0                           |
| LOW         | 1                           |
| MEDIUM      | 2–3                         |
| HIGH        | 4+                          |

The engine also counts independent DON_CLEAR to close reports (threshold 1 by default),
and a report's author cannot confirm their own signal (CR003), preventing fake
corroboration.

## Moderation

- Anyone can flag a report or an individual message with a single curated reason
  (`inaccurate`, `off_topic`, `abuse`, `spam`). Exactly one target per flag.
- Moderation evidence routes through `report_events` as `MODERATION_CHANGED`, feeding
  visible lifecycle transitions (a moderated report closes) without exposing the
  identity or the raw flag to the product.
- Automated/content gates are deferred to later milestones (see `MILESTONES.md`).

## Trade-offs accepted at M0B

- Anonymous-only means limited abuse attribution; mitigated by ephemerality,
  non-unique labels, duplicate/self-confirm guards, and moderation flags.
- Fixed-clock placeholder sunrise (06:00 Africa/Lagos) powers the overnight policy for
  demonstration; real sunrise per location/date is a documented M5 swap-in
  (`SunriseResolver` injection point already in the engine).
