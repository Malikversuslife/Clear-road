/**
 * Anonymous session model.
 *
 * Identity model: a session is identified internally by a UUID derived from
 * the Supabase anonymous-auth user id. The human-readable label ("ANON 82")
 * is PURELY COSMETIC: it is generated server-side, never sent by the client,
 * and is NOT guaranteed to be unique. Uniqueness/unlinkability of a session is
 * provided by the UUID, not the label.
 *
 * The label is generated once at session creation via a database function
 * (see supabase/migrations/..._anonymous_sessions.sql). Clients must never
 * supply their own label; doing so would let them impersonate another
 * display identity.
 */

export const ANON_LABEL_PREFIX = "ANON";
export const ANON_NUMBER_MIN = 10;
export const ANON_NUMBER_MAX = 99;

export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Sessions whose expiry passed within this window are still allowed a final renewal. */
export const SESSION_RENEWAL_GRACE_MS = 30 * 60 * 1000;

export function formatAnonLabel(number: number): string {
  if (!Number.isInteger(number)) {
    throw new RangeError(`Anonymous session number must be an integer, got ${number}`);
  }
  if (number < ANON_NUMBER_MIN || number > ANON_NUMBER_MAX) {
    throw new RangeError(
      `Anonymous session number must be between ${ANON_NUMBER_MIN} and ${ANON_NUMBER_MAX}, got ${number}`,
    );
  }
  return `${ANON_LABEL_PREFIX} ${number}`;
}

/** Deterministic-friendly random number generator for the cosmetic label. */
export function randomAnonNumber(random: () => number = Math.random): number {
  return Math.floor(random() * (ANON_NUMBER_MAX - ANON_NUMBER_MIN + 1)) + ANON_NUMBER_MIN;
}

/** Session expiry instant given its creation time and a TTL. */
export function sessionExpiry(createdAt: Date, ttlMs: number = DEFAULT_SESSION_TTL_MS): Date {
  return new Date(createdAt.getTime() + ttlMs);
}

export function isSessionExpired(expiresAt: Date | null, now: Date): boolean {
  if (expiresAt === null) return true;
  return now.getTime() >= expiresAt.getTime();
}

export function isSessionExpiredWithinGrace(
  expiresAt: Date | null,
  now: Date,
  graceMs: number = SESSION_RENEWAL_GRACE_MS,
): boolean {
  if (expiresAt === null) return true;
  return now.getTime() >= expiresAt.getTime() + graceMs;
}

/**
 * Whether a session may still participate. After the grace window a session
 * is considered dead and must authenticate again to obtain a new session.
 */
export function canSessionParticipate(expiresAt: Date | null, now: Date, graceMs = 0): boolean {
  if (expiresAt === null) return false;
  return now.getTime() < expiresAt.getTime() + graceMs;
}
