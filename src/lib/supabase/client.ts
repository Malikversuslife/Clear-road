import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Browser Supabase client (public anon key only).
 *
 * Returns null when the project has not been configured yet so the UI can
 * degrade gracefully during early development. Created lazily and memoized.
 */

let cached: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const env = getPublicSupabaseEnv();
  if (!env) {
    return null;
  }
  if (cached === undefined) {
    cached = createBrowserClient(env.url, env.anonKey);
  }
  return cached;
}
