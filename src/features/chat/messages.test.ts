import { describe, it, expect } from "vitest";
import { evaluateMessagePost, MESSAGE_MAX_LENGTH } from "@/features/chat/messages";

describe("evaluateMessagePost", () => {
  it("accepts a valid message for an open, unexpired report", () => {
    const result = evaluateMessagePost({
      body: "Anyone on this road?",
      reportOpen: true,
      reportExpired: false,
      sessionActive: true,
    });
    expect(result).toEqual({ ok: true, body: "Anyone on this road?" });
  });

  it("rejects a closed report", () => {
    const result = evaluateMessagePost({
      body: "hi",
      reportOpen: false,
      reportExpired: false,
      sessionActive: true,
    });
    expect(result).toEqual({ ok: false, code: "REPORT_CLOSED" });
  });

  it("rejects an expired report", () => {
    const result = evaluateMessagePost({
      body: "hi",
      reportOpen: true,
      reportExpired: true,
      sessionActive: true,
    });
    expect(result).toEqual({ ok: false, code: "REPORT_EXPIRED" });
  });

  it("rejects an inactive session", () => {
    const result = evaluateMessagePost({
      body: "hi",
      reportOpen: true,
      reportExpired: false,
      sessionActive: false,
    });
    expect(result).toEqual({ ok: false, code: "SESSION_INVALID" });
  });

  it("rejects an empty trimmed body", () => {
    const result = evaluateMessagePost({
      body: "   ",
      reportOpen: true,
      reportExpired: false,
      sessionActive: true,
    });
    expect(result).toEqual({ ok: false, code: "INVALID_BODY" });
  });

  it("rejects a body longer than the maximum", () => {
    const result = evaluateMessagePost({
      body: "x".repeat(MESSAGE_MAX_LENGTH + 1),
      reportOpen: true,
      reportExpired: false,
      sessionActive: true,
    });
    expect(result).toEqual({ ok: false, code: "INVALID_BODY" });
  });
});
