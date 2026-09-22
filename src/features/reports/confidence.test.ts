import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIDENCE_POLICY,
  computeConfidence,
  isConfidenceAtLeast,
  maxConfidence,
} from "@/features/reports/confidence";

describe("computeConfidence", () => {
  it("maps independent corroboration counts to levels", () => {
    expect(computeConfidence(0)).toBe("UNCONFIRMED");
    expect(computeConfidence(1)).toBe("LOW");
    expect(computeConfidence(2)).toBe("MEDIUM");
    expect(computeConfidence(3)).toBe("MEDIUM");
    expect(computeConfidence(4)).toBe("HIGH");
    expect(computeConfidence(9)).toBe("HIGH");
  });

  it("respects a custom policy", () => {
    const policy = { lowThreshold: 2, mediumThreshold: 5, highThreshold: 10 };
    expect(computeConfidence(1, policy)).toBe("UNCONFIRMED");
    expect(computeConfidence(2, policy)).toBe("LOW");
    expect(computeConfidence(10, policy)).toBe("HIGH");
  });

  it("rejects negative or fractional counts", () => {
    expect(() => computeConfidence(-1)).toThrow();
    expect(() => computeConfidence(1.5)).toThrow();
    expect(() => computeConfidence(NaN)).toThrow();
  });
});

describe("confidence helpers", () => {
  it("maxConfidence picks the stronger level", () => {
    expect(maxConfidence("UNCONFIRMED", "HIGH")).toBe("HIGH");
    expect(maxConfidence("MEDIUM", "MEDIUM")).toBe("MEDIUM");
    expect(maxConfidence("HIGH", "LOW")).toBe("HIGH");
  });

  it("isConfidenceAtLeast rates thresholds", () => {
    expect(isConfidenceAtLeast("HIGH", "LOW")).toBe(true);
    expect(isConfidenceAtLeast("LOW", "HIGH")).toBe(false);
    expect(isConfidenceAtLeast("MEDIUM", "MEDIUM")).toBe(true);
  });

  it("defaults are exported and stable", () => {
    expect(DEFAULT_CONFIDENCE_POLICY).toEqual({
      lowThreshold: 1,
      mediumThreshold: 2,
      highThreshold: 4,
    });
  });
});
