# Supabase security remediation — 2026-09-29

Project: `alxxrabpbucmbcmwmvxa` (Clear Road).

## Confirmed exposure and fix

The live `public.lifecycle_policy_config` table had RLS disabled and direct privileges for both `anon` and `authenticated`, including write and truncate privileges. This exposed internal lifecycle configuration through the database API. The advisor finding establishes exposure, not evidence of exploitation.

Applied migration `20260929212227_secure_lifecycle_policy_config.sql`:

- Enabled RLS with no browser policies (intentional internal-only configuration).
- Revoked all table privileges from PUBLIC, anon and authenticated, including TRUNCATE which RLS does not protect.
- Preserved owner/service-role access and existing SECURITY DEFINER reporting functions.
- Fixed `set_updated_at()` search_path to pg_catalog; its body only uses built-ins.

## Verification

The CLI dry run listed only this migration; the production push succeeded.
`supabase/tests/lifecycle_policy_security.sql` passed against the live project in a transaction ending in ROLLBACK. It verifies RLS, all browser table privileges revoked, actual denied read/write, the trigger search path, public map reads, anonymous session creation, report creation and confirmation. No test data was committed.

The security advisor rerun returned **zero ERROR findings**. Both `rls_disabled_in_public` and `function_search_path_mutable` disappeared.

## Initial remaining warnings (before follow-up)

- 14 warnings flag the seven existing SECURITY DEFINER API functions as callable by anon/authenticated. These are separate from the fixed table exposure. Authenticated access supports the RPC-based application; unsigned grants and individual function authorization deserve a separate least-privilege review. They were not blanket-revoked because that could break application behavior.
- One warning reports disabled leaked-password protection. The current application uses anonymous authentication. Password authentication settings were not changed by this migration.

This is a targeted remediation, not a claim that the entire application has been comprehensively security-audited. No evidence of past exploitation was established.

References: [RLS finding](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

## Follow-up hardening completed

Applied `20260929212823_restrict_browser_database_privileges.sql`:

- Revoked unsigned anon/PUBLIC execution of get_my_session, create_report, confirm_report, post_incident_message and flag_content. Anonymous sign-in carries the authenticated role, so the existing frontend sequence remains supported.
- Revoked unnecessary TRUNCATE, REFERENCES and TRIGGER privileges on the six other application tables from PUBLIC and both browser roles. This removes unnecessary database privileges; no claim is made that PostgREST exposes a TRUNCATE endpoint.
- Extended the rollback-only regression test to assert these privilege boundaries. All assertions and the session/create/confirm flow passed live.

Final advisor result: **0 errors, 10 warnings** (down from 15 after the first fix):

- Two unsigned read endpoints (active_reports and get_incident_messages) intentionally return public, active/unexpired data; messages additionally require visible moderation state and are capped at 200.
- Seven authenticated RPC warnings remain intentional under the current RPC-only write architecture. Mutation functions check auth.uid and session validity; get_my_session creates/refreshes only the caller's session. Keeping SECURITY DEFINER is necessary for their internal table access; blindly switching to SECURITY INVOKER would break that boundary.
- Leaked-password protection remains disabled. Clear Road's frontend uses anonymous sign-in, not password login. Supabase documents this protection as Pro-plan-and-above; no paid upgrade or auth-provider change was made. Enable it before introducing password accounts.

References: [anonymous users use authenticated role](https://supabase.com/docs/guides/auth/auth-anonymous), [password protection availability](https://supabase.com/docs/guides/auth/password-security).

## Final resolution of remaining database warnings

Applied `20260929213501_isolate_privileged_rpc_implementations.sql` after a successful rollback-only trial:

- Moved the seven privileged implementations into `clear_road_private`, outside the exposed API schemas.
- Retained the same public names, parameters, defaults, return shapes and volatility as SECURITY INVOKER wrappers with an empty search_path.
- Kept existing implementation authentication/input checks and restricted execute grants. Private schema USAGE permits wrapper execution; it does not expose the schema through PostgREST. Neither browser role can CREATE objects there. This is API isolation, not elimination of the controlled privileged operations.
- All seven endpoint workflows passed transactional regression tests; all test writes were rolled back.
- HTTP verification passed: public map RPC works, unsigned get_my_session is denied, and attempts to address clear_road_private directly fail with PGRST106 (schema not exposed).

The latest security advisor contains **zero errors and one warning only**, `auth_leaked_password_protection`. All database warnings are cleared.

The dashboard confirms this organization is on Free and leaked-password protection is Pro-only. The user explicitly chose **Keep Free; document the limitation**. No upgrade was purchased and no authentication provider was disabled to hide the warning. This remains a known limitation, relevant if password-based accounts are used. The application currently uses anonymous sign-in.

Future RPC implementation edits must target `clear_road_private`; preserve the public invoker wrappers and their grants. Do not recreate SECURITY DEFINER implementations in public. Do not add clear_road_private to the API's exposed schemas.
