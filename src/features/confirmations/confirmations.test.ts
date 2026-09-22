import { describe, it, expect } from "vitest";
import {
  evaluateConfirmation,
  shouldCloseReport,
  isSelfConfirmation,
} from "@/features/confirmations/confirmations";
import type { ReportLifecycle } from "@/types";

const REPORTER = "session-A";
const OTHER = "session-B";

function openReport(
  overrides: Partial<Parameters<typeof evaluateConfirmation>[0]["report"] & object> = {},
) {
  return {
    id: "report-1",
    reporterSessionId: REPORTER,
    lifecycle: "ACTIVE" as ReportLifecycle,
    closedAt: null,
    expiresAt: new Date("2026-01-05T10:00:00Z"),
    ...overrides,
  };
}

function baseInput(overrides: Partial<Parameters<typeof evaluateConfirmation>[0]> = {}) {
  return {
    report: openReport(),
    sessionId: OTHER,
    signal: "STILL_DEY",
    now: new Date("2026-01-05T09:00:00Z"),
    existingSignals: [],
    sessionActive: true,
    ...overrides,
  };
}

describe("evaluateConfirmation", () => {
  it("accepts a valid STILL_DEY confirmation", () => {
    const result = evaluateConfirmation(baseInput());
    expect(result).toEqual({ ok: true, signal: "STILL_DEY" });
  });

  it("accepts a valid DON_CLEAR confirmation", () => {
    const result = evaluateConfirmation(baseInput({ signal: "DON_CLEAR" }));
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid signal", () => {
    const result = evaluateConfirmation(baseInput({ signal: "MAYBE" }));
    expect(result).toEqual({ ok: false, code: "INVALID_SIGNAL" });
  });

  it("rejects when the report does not exist", () => {
    const result = evaluateConfirmation(baseInput({ report: null }));
    expect(result).toEqual({ ok: false, code: "REPORT_NOT_FOUND" });
  });

  it("rejects a self-confirmation by the reporter", () => {
    const result = evaluateConfirmation(baseInput({ sessionId: REPORTER }));
    expect(result).toEqual({ ok: false, code: "SELF_CONFIRMATION" });
  });

  it("rejects a duplicate signal from the same session", () => {
    const result = evaluateConfirmation(baseInput({ existingSignals: ["STILL_DEY"] }));
    expect(result).toEqual({ ok: false, code: "DUPLICATE_SIGNAL" });
  });

  it("rejects a closed report", () => {
    const result = evaluateConfirmation(
      baseInput({ report: openReport({ lifecycle: "CLOSED", closedAt: new Date() }) }),
    );
    expect(result).toEqual({ ok: false, code: "REPORT_CLOSED" });
  });

  it("rejects an expired report", () => {
    const result = evaluateConfirmation(baseInput({ now: new Date("2026-01-05T11:00:00Z") }));
    expect(result).toEqual({ ok: false, code: "REPORT_EXPIRED" });
  });

  it("rejects an inactive (expired) session", () => {
    const result = evaluateConfirmation(baseInput({ sessionActive: false }));
    expect(result).toEqual({ ok: false, code: "SESSION_INVALID" });
  });
});

describe("isSelfConfirmation", () => {
  it("detects self-confirmation", () => {
    expect(isSelfConfirmation("A", "A")).toBe(true);
    expect(isSelfConfirmation("A", "B")).toBe(false);
    expect(isSelfConfirmation("", "A")).toBe(false);
  });
});

describe("shouldCloseReport", () => {
  it("closes once the don-clear threshold is reached", () => {
    expect(shouldCloseReport(0)).toBe(false);
    expect(shouldCloseReport(1)).toBe(true);
    expect(shouldCloseReport(2, 3)).toBe(false);
    expect(shouldCloseReport(3, 3)).toBe(true);
  });
});
