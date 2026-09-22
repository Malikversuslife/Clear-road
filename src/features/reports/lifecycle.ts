import type { ReportCategory, ReportCloseReason, ReportLifecycle } from "@/types";

/**
 * Lifecycle + expiry engine for CLEAR ROAD reports.
 *
 * Reports are ephemeral. This module is PURE and fully configurable so the
 * timing policy can be reasoned about and tested in isolation from the
 * database layer. The database mirrors these rules inside its RPC functions
 * (see supabase/migrations/..._security_functions.sql); this module is the
 * reference implementation and the source of truth for expected behaviour.
 *
 * Lifecycle vs confidence: lifecycle is TIME-based (how relevant the report
 * is right now); confidence is EVIDENCE-based (how many independent people
 * corroborated it). They must never be conflated.
 *
 * Lifecycle mapping:
 *   NEW     — just created, within the "new window", no corroboration yet.
 *   ACTIVE  — corroborated (>=1 independent STILL_DEY) and still recent.
 *   RECENT  — unconfirmed but still inside its initial lifetime.
 *   STALE   — past its expiry (or confirmations stopped being recent); the
 *             report is no longer shown live but can still be closed cleanly.
 *   CLOSED  — removed from the live product (DON_CLEAR, expiry after grace,
 *             moderation, or sunrise reset).
 *
 * Expiry is computed from: initial lifetime + per-confirmation extensions
 * (capped), a hard max lifetime, and — for "overnight reset" categories —
 * a sunrise-aware reset so late-night reports survive until morning instead
 * of dying a few minutes after creation.
 *
 * Sunrise-awareness: M0B ships a fixed-clock sunrise resolver
 * (06:00 Africa/Lagos replaced by a real sunrise service in M5). The engine
 * only depends on a `SunriseResolver` injected function, so swapping in a
 * location/date aware service later requires no engine changes.
 */

export interface LifecyclePolicy {
  /** Base lifetime for a fresh report. */
  initialLifetimeMs: number;
  /** Extra lifetime granted per independent STILL_DEY confirmation. */
  confirmationExtensionMs: number;
  /** Max number of confirmations that may extend the expiration. */
  maxConfirmationsCounted: number;
  /** Hard cap on report lifetime regardless of confirmations. */
  maxLifetimeMs: number;
  /** After this much time without a fresh confirmation, ACTIVE decays to STALE. */
  staleAfterMs: number;
  /** STALE reports hang around this long before being auto-CLOSED (EXPIRED). */
  staleGraceMs: number;
  /** A brand-new (uncorroborated) report stays NEW for this long. */
  newWindowMs: number;
  /** Don-clear signals required to close a report. Default 1. */
  donClearCloseThreshold: number;
  /** Sun policy (sunrise time / overnight-window start). */
  sun?: Partial<SunPolicy>;
}

export interface SunPolicy {
  /** IANA timezone used for sunrise/date arithmetic on location. */
  timeZone: string;
  /** Wall-clock hour of the placeholder sunrise. */
  sunriseHour: number;
  sunriseMinute: number;
  /** Wall-clock hour when the "overnight window" is considered to begin. */
  overnightStartHour: number;
  overnightStartMinute: number;
}

export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicy = {
  initialLifetimeMs: 45 * 60_000,
  confirmationExtensionMs: 15 * 60_000,
  maxConfirmationsCounted: 4,
  maxLifetimeMs: 3 * 60 * 60_000,
  staleAfterMs: 15 * 60_000,
  staleGraceMs: 30 * 60_000,
  newWindowMs: 5 * 60_000,
  donClearCloseThreshold: 1,
};

export const DEFAULT_SUN_POLICY: SunPolicy = {
  timeZone: "Africa/Lagos",
  sunriseHour: 6,
  sunriseMinute: 0,
  overnightStartHour: 18,
  overnightStartMinute: 0,
};

/**
 * Overnight-reset categories: created late at night they survive until the
 * next sunrise instead of expiring within minutes. Currently police presence
 * and checkpoints — the two categories that typically materialise overnight.
 */
export const OVERNIGHT_RESET_CATEGORIES: ReadonlySet<ReportCategory> = new Set([
  "police_presence",
  "checkpoint_roadblock",
]);

export interface SunriseResolver {
  (instant: Date): Date;
}

export function mergeLifecyclePolicy(patch?: Partial<LifecyclePolicy>): LifecyclePolicy {
  return {
    ...DEFAULT_LIFECYCLE_POLICY,
    ...patch,
    sun: { ...DEFAULT_SUN_POLICY, ...(patch?.sun ?? {}) },
  };
}

function zonedDateTimeParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

/** Placeholder sunrise resolver: fixed wall-clock hour in a fixed timezone. */
export function fixedClockSunriseResolver(sun: Partial<SunPolicy> = {}): SunriseResolver {
  const policy: SunPolicy = { ...DEFAULT_SUN_POLICY, ...sun };
  return (instant) => {
    const { year, month, day } = zonedDateTimeParts(instant, policy.timeZone);
    return new Date(Date.UTC(year, month - 1, day, policy.sunriseHour, policy.sunriseMinute));
  };
}

/** Instant of the overnight-window start for the calendar day of `instant`. */
export function overnightStartFor(instant: Date, sun: Partial<SunPolicy> = {}): Date {
  const policy: SunPolicy = { ...DEFAULT_SUN_POLICY, ...sun };
  const { year, month, day } = zonedDateTimeParts(instant, policy.timeZone);
  return new Date(
    Date.UTC(year, month - 1, day, policy.overnightStartHour, policy.overnightStartMinute),
  );
}

function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

export interface ExpiryInput {
  createdAt: Date;
  /** Independent (non-reporter) STILL_DEY confirmations. */
  stillDeyCount: number;
  /** Independent DON_CLEAR confirmations. */
  donClearCount: number;
  category: ReportCategory;
  closedAt?: Date | null;
  policy?: Partial<LifecyclePolicy>;
  overnightCategories?: ReadonlySet<ReportCategory>;
  /** Inject a sunrise resolver (tests, or M5 real service). */
  sunrise?: SunriseResolver;
}

/**
 * The instant a report should stop being relevant to the live product.
 * Returns null when the report is already closed (expiry no longer applies).
 */
export function computeExpiry(input: ExpiryInput): Date | null {
  const policy = mergeLifecyclePolicy(input.policy);
  const sun = { ...DEFAULT_SUN_POLICY, ...(input.policy?.sun ?? {}) };

  if (input.closedAt) return null;
  if (input.donClearCount >= policy.donClearCloseThreshold) return null;

  const createdMs = input.createdAt.getTime();
  const baseMs = Math.min(
    createdMs +
      policy.initialLifetimeMs +
      policy.confirmationExtensionMs *
        Math.min(input.stillDeyCount, policy.maxConfirmationsCounted),
    createdMs + policy.maxLifetimeMs,
  );
  const base = new Date(baseMs);

  const overnight = input.overnightCategories ?? OVERNIGHT_RESET_CATEGORIES;
  if (!overnight.has(input.category)) {
    return base;
  }

  const sunrise = input.sunrise ?? fixedClockSunriseResolver(sun);
  const todaySunrise = sunrise(input.createdAt);
  const nextSunrise = sunrise(addDays(input.createdAt, 1));
  const tonightFall = overnightStartFor(input.createdAt, sun);

  const preDawn = createdMs < todaySunrise.getTime();
  const inEvening = createdMs >= tonightFall.getTime();

  let expiryMs: number;
  if (preDawn) {
    expiryMs = todaySunrise.getTime();
  } else if (inEvening) {
    expiryMs = nextSunrise.getTime();
  } else {
    // Created during the day. Only extend into the night if it would still be
    // alive at nightfall — otherwise keep the regular lifetime.
    expiryMs = baseMs > tonightFall.getTime() ? nextSunrise.getTime() : baseMs;
  }

  return new Date(Math.max(expiryMs, baseMs));
}

export interface LifecycleInput extends ExpiryInput {
  now: Date;
  lastConfirmedAt?: Date | null;
  /** Reason the report was closed, when closedAt is set. */
  closedReason?: ReportCloseReason | null;
}

export interface LifecycleResult {
  lifecycle: ReportLifecycle;
  expiresAt: Date | null;
  autoCloseReason: ReportCloseReason | null;
}

/** Compute the current lifecycle for a report snapshot. Pure + deterministic. */
export function computeLifecycle(input: LifecycleInput): LifecycleResult {
  const policy = mergeLifecyclePolicy(input.policy);

  if (input.closedAt) {
    return { lifecycle: "CLOSED", expiresAt: null, autoCloseReason: input.closedReason ?? null };
  }
  if (input.donClearCount >= policy.donClearCloseThreshold) {
    return { lifecycle: "CLOSED", expiresAt: null, autoCloseReason: "DON_CLEAR" };
  }

  const expiresAt = computeExpiry(input);
  if (expiresAt === null) {
    return { lifecycle: "CLOSED", expiresAt: null, autoCloseReason: null };
  }

  const nowMs = input.now.getTime();
  const createdMs = input.createdAt.getTime();

  // Clock-skew guard: treat an impossibly early `now` as brand new.
  if (nowMs < createdMs) {
    return { lifecycle: "NEW", expiresAt, autoCloseReason: null };
  }

  if (nowMs >= expiresAt.getTime() + policy.staleGraceMs) {
    return { lifecycle: "CLOSED", expiresAt, autoCloseReason: "EXPIRED" };
  }
  if (nowMs >= expiresAt.getTime()) {
    return { lifecycle: "STALE", expiresAt, autoCloseReason: null };
  }

  if (input.stillDeyCount > 0) {
    const lastConfirmedMs = input.lastConfirmedAt?.getTime() ?? createdMs;
    const staleCutoff = lastConfirmedMs + policy.staleAfterMs;
    return {
      lifecycle: nowMs >= staleCutoff ? "STALE" : "ACTIVE",
      expiresAt,
      autoCloseReason: null,
    };
  }

  const newCutoff = createdMs + policy.newWindowMs;
  return { lifecycle: nowMs <= newCutoff ? "NEW" : "RECENT", expiresAt, autoCloseReason: null };
}

/** Reports in these lifecycles are offered to the live product. */
const LIVE_LIFECYCLES: ReadonlySet<ReportLifecycle> = new Set(["NEW", "ACTIVE", "RECENT"]);

export function isVisibleLive(lifecycle: ReportLifecycle): boolean {
  return LIVE_LIFECYCLES.has(lifecycle);
}

/** Convenience evaluator used by the API and the tests. */
export function evaluateReport(
  input: LifecycleInput,
): LifecycleResult & { isVisibleLive: boolean } {
  const result = computeLifecycle(input);
  return { ...result, isVisibleLive: isVisibleLive(result.lifecycle) };
}
