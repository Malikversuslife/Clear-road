import { describe, it, expect } from "vitest";
import { validateCreateReport } from "@/features/reports/validation";

const validPayload = {
  category: "accident",
  location: { lat: 6.5244, lng: 3.3792 },
  note: "Stalled lorry, slow down",
};

describe("validateCreateReport", () => {
  it("accepts a valid report payload", () => {
    const result = validateCreateReport(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.category).toBe("accident");
      expect(result.value.note).toBe("Stalled lorry, slow down");
    }
  });

  it("rejects an unknown category", () => {
    const result = validateCreateReport({ ...validPayload, category: "ufo_sighting" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing location", () => {
    const result = validateCreateReport({ category: "accident", note: "Stalled lorry, slow down" });
    expect(result.ok).toBe(false);
  });

  it("rejects excessive note length", () => {
    const result = validateCreateReport({ ...validPayload, note: "x".repeat(281) });
    expect(result.ok).toBe(false);
  });

  it("binds blank notes to null", () => {
    const result = validateCreateReport({ ...validPayload, note: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.note).toBeNull();
  });

  it("rejects unrecognised extra fields", () => {
    const result = validateCreateReport({ ...validPayload, hacker: true });
    expect(result.ok).toBe(false);
  });
});
