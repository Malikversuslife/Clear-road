import { describe, it, expect } from "vitest";
import {
  DEFAULT_LIFECYCLE_POLICY,
  computeExpiry,
  computeLifecycle,
  evaluateReport,
  fixedClockSunriseResolver,
  isVisibleLive,
  mergeLifecyclePolicy,
  overnightStartFor,
} from "@/features/reports/lifecycle";
import type { ReportCategory, ReportLifecycle } from "@/types";

const MS = 60_000;

const fixedSun = { timeZone: "UTC", sunriseHour: 6, overnightStartHour: 18 };

function at(iso: string): Date {
  return new Date(iso);
}

/**
 * Deterministic "now" for tests so results do not depend on wall time.
 */
let virtualNow = 0;
const nowFn = () => {
  const d = new Date(virtualNow);
  return d;
};
const t = (iso: string) => {
  virtualNow = new Date(iso).getTime();
  return at(iso);
};

describe("computeExpiry", () => {
  it("uses the initial lifetime for a fresh report", () => {
    const created = at("2026-01-05T08:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "accident",
    });
    expect(expiry!.toISOString()).toBe("2026-01-05T08:45:00.000Z");
  });

  it("adds per-confirmation extensions but caps contributions", () => {
    const created = at("2026-01-05T08:00:00Z");
    // 3 confirmations: base 45min + 3 x 15min -> 09:30
    const expiry3 = computeExpiry({
      createdAt: created,
      stillDeyCount: 3,
      donClearCount: 0,
      category: "accident",
    });
    expect(expiry3!.toISOString()).toBe("2026-01-05T09:30:00.000Z");
    // 9 confirmations are capped at maxConfirmationsCounted (4): 45 + 4*15 = 105min
    const expiry9 = computeExpiry({
      createdAt: created,
      stillDeyCount: 9,
      donClearCount: 0,
      category: "accident",
    });
    expect(expiry9!.toISOString()).toBe("2026-01-05T09:45:00.000Z");
  });

  it("respects the hard max lifetime", () => {
    const created = at("2026-01-05T08:00:00Z");
    // With a short max lifetime, the cap dominates the confirmation extensions.
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 9,
      donClearCount: 0,
      category: "accident",
      policy: { maxLifetimeMs: 60 * 60_000 },
    });
    expect(expiry!.getTime()).toBe(created.getTime() + 60 * 60_000);
  });

  it("returns null for closed reports", () => {
    const created = at("2026-01-05T08:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "accident",
      closedAt: at("2026-01-05T08:10:00Z"),
    });
    expect(expiry).toBeNull();
  });

  it("returns null once don-clear threshold is met", () => {
    const created = at("2026-01-05T08:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 1,
      category: "accident",
    });
    expect(expiry).toBeNull();
  });
});

describe("computeExpiry with overnight sun policy", () => {
  const policy = { sun: fixedSun };

  it("keeps a pre-dawn police report alive until this morning's sunrise", () => {
    const created = at("2026-01-05T02:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "police_presence",
      policy,
    });
    // base would be 02:45, but the sun policy overrides to 06:00
    expect(expiry!.toISOString()).toBe("2026-01-05T06:00:00.000Z");
  });

  it("keeps an evening checkpoint alive until the next sunrise", () => {
    const created = at("2026-01-05T20:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "checkpoint_roadblock",
      policy,
    });
    expect(expiry!.toISOString()).toBe("2026-01-06T06:00:00.000Z");
  });

  it("keeps daytime reports that would outlive nightfall until the next sunrise", () => {
    const created = at("2026-01-05T16:00:00Z");
    // enough counted confirmations push the base past nightfall (18:00)
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 6,
      donClearCount: 0,
      category: "police_presence",
      policy: { maxConfirmationsCounted: 6, sun: fixedSun },
    });
    expect(expiry!.toISOString()).toBe("2026-01-06T06:00:00.000Z");
  });

  it("does not extend daytime reports that expire before nightfall", () => {
    const created = at("2026-01-05T09:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "police_presence",
      policy,
    });
    expect(expiry!.toISOString()).toBe("2026-01-05T09:45:00.000Z");
  });

  it("does not apply the sun policy to non-overnight categories", () => {
    const created = at("2026-01-05T20:00:00Z");
    const expiry = computeExpiry({
      createdAt: created,
      stillDeyCount: 0,
      donClearCount: 0,
      category: "accident",
      policy,
    });
    expect(expiry!.toISOString()).toBe("2026-01-05T20:45:00.000Z");
  });
});

describe("computeLifecycle", () => {
  it("NEW: unconfirmed and inside the new window", () => {
    t("2026-01-05T10:00:00Z");
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T10:00:00Z"),
      now: nowFn(),
      stillDeyCount: 0,
    });
    expect(result.lifecycle).toBe("NEW");
    expect(isVisibleLive(result.lifecycle)).toBe(true);
  });

  it("RECENT: unconfirmed after the new window but before expiry", () => {
    t("2026-01-05T10:10:00Z");
    const result = computeLifecycle({
      ...base("heavy_traffic"),
      createdAt: at("2026-01-05T10:00:00Z"),
      now: nowFn(),
      stillDeyCount: 0,
    });
    expect(result.lifecycle).toBe("RECENT");
  });

  it("ACTIVE: corroborated and still fresh", () => {
    t("2026-01-05T10:20:00Z");
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T10:00:00Z"),
      now: nowFn(),
      stillDeyCount: 1,
      lastConfirmedAt: at("2026-01-05T10:15:00Z"),
    });
    expect(result.lifecycle).toBe("ACTIVE");
  });

  it("STALE: confirms stopped being recent", () => {
    t("2026-01-05T10:40:00Z");
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T10:00:00Z"),
      now: nowFn(),
      stillDeyCount: 1,
      lastConfirmedAt: at("2026-01-05T10:10:00Z"),
    });
    expect(result.lifecycle).toBe("STALE");
  });

  it("STALE: past expiry but within grace", () => {
    t("2026-01-05T09:00:00Z");
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T08:00:00Z"),
      now: nowFn(),
      stillDeyCount: 0,
    });
    // expiry at 08:45, now at 09:00 -> stale and within the 30m grace window
    expect(result.lifecycle).toBe("STALE");
  });

  it("CLOSED (EXPIRED): beyond expiry plus grace", () => {
    t("2026-01-05T09:30:00Z");
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T08:00:00Z"),
      now: nowFn(),
      stillDeyCount: 0,
    });
    expect(result.lifecycle).toBe("CLOSED");
    expect(result.autoCloseReason).toBe("EXPIRED");
  });

  it("CLOSED when explicitly closed", () => {
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T08:00:00Z"),
      now: nowFn(),
      stillDeyCount: 0,
      closedAt: at("2026-01-05T08:30:00Z"),
      closedReason: "MODERATED",
    });
    expect(result.lifecycle).toBe("CLOSED");
    expect(result.autoCloseReason).toBe("MODERATED");
  });

  it("CLOSED (DON_CLEAR) once the threshold is met", () => {
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T08:00:00Z"),
      now: nowFn(),
      stillDeyCount: 2,
      donClearCount: 1,
    });
    expect(result.lifecycle).toBe("CLOSED");
    expect(result.autoCloseReason).toBe("DON_CLEAR");
  });

  it("NEW survives clock skew (now earlier than created)", () => {
    const result = computeLifecycle({
      ...base("accident"),
      createdAt: at("2026-01-05T10:00:00Z"),
      now: at("2026-01-05T09:59:00Z"),
      stillDeyCount: 0,
    });
    expect(result.lifecycle).toBe("NEW");
  });
});

describe("evaluateReport / visibility", () => {
  it("marks NEW, ACTIVE, RECENT as live; STALE and CLOSED as not", () => {
    expect(
      evaluateReport({
        ...base("accident"),
        createdAt: at("2026-01-05T10:00:00Z"),
        now: at("2026-01-05T10:02:00Z"),
        stillDeyCount: 0,
      }).isVisibleLive,
    ).toBe(true);
    expect(
      evaluateReport({
        ...base("accident"),
        createdAt: at("2026-01-05T10:00:00Z"),
        now: at("2026-01-05T10:20:00Z"),
        stillDeyCount: 1,
        lastConfirmedAt: at("2026-01-05T10:15:00Z"),
      }).isVisibleLive,
    ).toBe(true);
    expect(
      evaluateReport({
        ...base("accident"),
        createdAt: at("2026-01-05T08:00:00Z"),
        now: at("2026-01-05T09:00:00Z"),
        stillDeyCount: 0,
      }).isVisibleLive,
    ).toBe(false);
    expect(
      evaluateReport({
        ...base("accident"),
        createdAt: at("2026-01-05T08:00:00Z"),
        now: at("2026-01-05T09:00:00Z"),
        stillDeyCount: 0,
        closedAt: at("2026-01-05T08:50:00Z"),
      }).isVisibleLive,
    ).toBe(false);
  });
});

describe("mergeLifecyclePolicy", () => {
  it("merges partial policy over defaults and keeps sun defaults", () => {
    const p = mergeLifecyclePolicy({ initialLifetimeMs: 60 * MS });
    expect(p.initialLifetimeMs).toBe(60 * MS);
    expect(p.maxLifetimeMs).toBe(DEFAULT_LIFECYCLE_POLICY.maxLifetimeMs);
    expect(p.sun?.sunriseHour).toBe(6);
  });
});

describe("fixedClockSunriseResolver / overnightStartFor", () => {
  it("returns the fixed sunrise in the policy timezone", () => {
    const resolver = fixedClockSunriseResolver({ ...fixedSun, timeZone: "Africa/Lagos" });
    // Jan 5 2026 20:00Z = 21:00 in Lagos (UTC+1), date still Jan 5
    const sunrise = resolver(at("2026-01-05T20:00:00Z"));
    expect(sunrise.getUTCHours()).toBe(6); // placeholder is deliberately timezone-agnostic wall clock
  });

  it("overnightStartFor returns the configured wall-clock start", () => {
    const start = overnightStartFor(at("2026-01-05T12:00:00Z"), fixedSun);
    expect(start.getUTCHours()).toBe(18);
  });
});

function base(category: ReportCategory): {
  createdAt: Date;
  donClearCount: number;
  category: ReportCategory;
  lifecycle: ReportLifecycle;
} {
  return {
    createdAt: at("2026-01-05T08:00:00Z"),
    donClearCount: 0,
    category,
    lifecycle: "NEW",
  };
}
