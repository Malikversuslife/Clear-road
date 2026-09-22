import { describe, it, expect } from "vitest";
import {
  ANON_LABEL_PREFIX,
  ANON_NUMBER_MAX,
  ANON_NUMBER_MIN,
  DEFAULT_SESSION_TTL_MS,
  SESSION_RENEWAL_GRACE_MS,
  canSessionParticipate,
  formatAnonLabel,
  isSessionExpired,
  isSessionExpiredWithinGrace,
  randomAnonNumber,
  sessionExpiry,
} from "@/features/anon-sessions/session";

describe("formatAnonLabel", () => {
  it("formats a label within the allowed range", () => {
    expect(formatAnonLabel(10)).toBe("ANON 10");
    expect(formatAnonLabel(99)).toBe("ANON 99");
  });

  it("rejects non-integers and out-of-range numbers", () => {
    expect(() => formatAnonLabel(9)).toThrow();
    expect(() => formatAnonLabel(100)).toThrow();
    expect(() => formatAnonLabel(1.5)).toThrow();
  });
});

describe("randomAnonNumber", () => {
  it("respects the configured bounds for extremes of Math.random", () => {
    expect(randomAnonNumber(() => 0)).toBe(ANON_NUMBER_MIN);
    // Math.random() never returns 1, so simulate the largest representable fraction
    const nearOne = () => 0.999999;
    expect(randomAnonNumber(nearOne)).toBeLessThanOrEqual(ANON_NUMBER_MAX);
    expect(randomAnonNumber(nearOne)).toBeGreaterThanOrEqual(ANON_NUMBER_MIN);
  });
});

describe("session expiry", () => {
  const created = new Date("2026-01-05T09:00:00Z");

  it("computes a 24h expiry by default", () => {
    expect(sessionExpiry(created).getTime()).toBe(created.getTime() + DEFAULT_SESSION_TTL_MS);
  });

  it("accepts a custom TTL", () => {
    expect(sessionExpiry(created, 60_000).toISOString()).toBe("2026-01-05T09:01:00.000Z");
  });

  it("detects hard expiry", () => {
    const expiresAt = new Date("2026-01-06T09:00:00Z");
    expect(isSessionExpired(expiresAt, new Date("2026-01-06T09:00:01Z"))).toBe(true);
    expect(isSessionExpired(expiresAt, new Date("2026-01-06T08:59:59Z"))).toBe(false);
  });

  it("allows a grace window before declaring a session dead", () => {
    const expiresAt = new Date("2026-01-06T09:00:00Z");
    const fiveMinutesLater = new Date(expiresAt.getTime() + 5 * 60_000);
    expect(isSessionExpiredWithinGrace(expiresAt, fiveMinutesLater, SESSION_RENEWAL_GRACE_MS)).toBe(
      false,
    );
    const fortyMinutesLater = new Date(expiresAt.getTime() + 40 * 60_000);
    expect(
      isSessionExpiredWithinGrace(expiresAt, fortyMinutesLater, SESSION_RENEWAL_GRACE_MS),
    ).toBe(true);
  });

  it("canSessionParticipate respects the grace window", () => {
    const expiresAt = new Date("2026-01-06T09:00:00Z");
    const afterGrace = new Date(expiresAt.getTime() + 45 * 60_000);
    expect(canSessionParticipate(expiresAt, new Date("2026-01-06T08:30:00Z"))).toBe(true);
    expect(canSessionParticipate(expiresAt, afterGrace)).toBe(false);
    expect(canSessionParticipate(null, new Date())).toBe(false);
  });
});

describe("label prefix constant", () => {
  it("is the documented display prefix", () => {
    expect(ANON_LABEL_PREFIX).toBe("ANON");
  });
});
