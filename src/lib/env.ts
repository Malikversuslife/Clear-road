import { z } from "zod";

/**
 * Environment handling for CLEAR ROAD.
 *
 * Design rules:
 *  - NEXT_PUBLIC_* variables are inlined into the browser bundle by Next.js
 *    and are public by design (the anon key is a public identifier gated by
 *    RLS + RPC functions, never a secret).
 *  - SUPABASE_SERVICE_ROLE_KEY is server-only. It is only referenced here and
 *    in the admin client, which imports `server-only` so Next refuses to
 *    bundle it into the client. In the browser bundle it is `undefined`.
 *  - All values are optional at the schema level so the project installs and
 *    builds without configured infrastructure. Callers that require values
 *    guard with the helpers below and fail loudly when missing.
 */

const supabaseUrlSchema = z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
const supabaseKeySchema = z.string().min(1, "Supabase key cannot be empty");

const publicEnvSchema = z.object({
  url: supabaseUrlSchema,
  anonKey: supabaseKeySchema,
});

const adminEnvSchema = z.object({
  url: supabaseUrlSchema,
  serviceRoleKey: supabaseKeySchema,
});

/** Public (browser-safe) Supabase configuration, or null when not configured. */
export function getPublicSupabaseEnv(): { url: string; anonKey: string } | null {
  const parsed = publicEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

/** True only when the public (browser) configuration is present and valid. */
export function hasPublicSupabaseEnv(): boolean {
  return getPublicSupabaseEnv() !== null;
}

/** Full server-side configuration (includes the service-role key). Server-only. */
export function getAdminEnv(): { url: string; serviceRoleKey: string } | null {
  const parsed = adminEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Throws when the server-side admin environment is missing or malformed.
 * Used by the admin client so misconfiguration fails fast on the server.
 */
export function assertAdminEnv(): { url: string; serviceRoleKey: string } {
  const env = getAdminEnv();
  if (!env) {
    throw new Error(
      "Supabase admin environment is not configured. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY. The service-role key must never be exposed to the browser.",
    );
  }
  return env;
}

/** Pure validation helper (used by tests) for the public environment shape. */
export function parsePublicEnv(value: {
  url?: string;
  anonKey?: string;
}): { url: string; anonKey: string } | null {
  const parsed = publicEnvSchema.safeParse({ url: value.url, anonKey: value.anonKey });
  return parsed.success ? parsed.data : null;
}
