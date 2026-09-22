import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/env";

/**
 * Server-side Supabase client (public anon key, RLS-aware JWT from cookies).
 *
 * Intended for RSC / route handlers / server actions in M1+. Auth state is
 * carried in cookies set/read through Next's cookie store.
 *
 * Returns null when the project is not configured.
 */

export async function getSupabaseServerClient() {
  const env = getPublicSupabaseEnv();
  if (!env) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — Next does not allow cookies to be
          // modified here. Middleware/route handlers can set session cookies.
        }
      },
    },
  });
}
