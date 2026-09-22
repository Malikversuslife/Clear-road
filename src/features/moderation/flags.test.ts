import { describe, it, expect } from "vitest";
import {
  flagInputSchema,
  parseFlagReason,
  parseFlagTarget,
  FLAG_NOTE_MAX_LENGTH,
} from "@/features/moderation/flags";

function validReportFlag() {
  return {
    targetType: "REPORT",
    reportId: "5044c02c-8061-49bd-a03d-7ea9e0a1e95e",
    messageId: null,
    reason: "SPAM",
  };
}

describe("flagInputSchema", () => {
  it("accepts a valid report flag", () => {
    expect(flagInputSchema.safeParse(validReportFlag()).success).toBe(true);
  });

  it("accepts a valid message flag", () => {
    const input = {
      targetType: "MESSAGE",
      reportId: null,
      messageId: "35eb3f59-72f6-4b4a-a7e0-3e80b1e1d17c",
      reason: "HARASSMENT",
    };
    expect(flagInputSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a REPORT flag without a report id", () => {
    const input = { ...validReportFlag(), reportId: null };
    const result = flagInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects a MESSAGE flag without a message id", () => {
    const input = {
      targetType: "MESSAGE",
      reportId: null,
      messageId: null,
      reason: "SPAM",
    };
    const result = flagInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects a flag carrying both targets", () => {
    const input = {
      targetType: "REPORT",
      reportId: "5044c02c-8061-49bd-a03d-7ea9e0a1e95e",
      messageId: "35eb3f59-72f6-4b4a-a7e0-3e80b1e1d17c",
      reason: "SPAM",
    };
    expect(flagInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an unknown reason", () => {
    expect(flagInputSchema.safeParse({ ...validReportFlag(), reason: "TYPO" }).success).toBe(false);
  });

  it("rejects a note exceeding the maximum length", () => {
    expect(
      flagInputSchema.safeParse({
        ...validReportFlag(),
        note: "x".repeat(FLAG_NOTE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed uuid", () => {
    expect(
      flagInputSchema.safeParse({ ...validReportFlag(), reportId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("parseFlagReason / parseFlagTarget", () => {
  it("parses valid values", () => {
    expect(parseFlagReason("SPAM")).toEqual({ ok: true, value: "SPAM" });
    expect(parseFlagTarget("REPORT")).toEqual({ ok: true, value: "REPORT" });
  });

  it("rejects invalid values", () => {
    expect(parseFlagReason("NOPE").ok).toBe(false);
    expect(parseFlagTarget("THREAD").ok).toBe(false);
  });
});
