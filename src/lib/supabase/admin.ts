import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertAdminEnv } from "@/lib/env";

/**
 * Service-role Supabase client. SERVER ONLY.
 *
 * This client bypasses RLS. It must:
 *  - never be imported from a module that is bundled for the browser
 *    (enforced by `import "server-only"`),
 *  - be used exclusively by trusted server code: maintenance jobs,
 *    moderation tooling, and back-office operations,
 *  - never be handed to the client or exposed through an API surface that a
 *    browser consumer could reach directly.
 *
 * Browser flows MUST go through the authenticated anon-key client plus the
 * public RPC functions defined in supabase/migrations.
 */

let cached: SupabaseClient | null | undefined;

export function getSupabaseAdminClient(): SupabaseClient {
  const env = assertAdminEnv();
  if (cached === undefined || cached === null) {
    cached = createClient(env.url, env.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cached;
}
