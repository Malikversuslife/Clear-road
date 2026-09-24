import { describe, expect, it } from "vitest";
import { reportErrorMessage } from "./client";
import { reportFlowReducer, startReportFlow } from "./report-flow";

describe("report flow", () => {
  const location = { lat: 6.5244, lng: 3.3792 };

  it("moves from category through location, context, review, and submit", () => {
    let state = startReportFlow(location);
    expect(state.phase).toBe("category");
    state = reportFlowReducer(state, { type: "select-category", category: "flooded_road" });
    state = reportFlowReducer(state, { type: "set-location", location: { lat: 6.53, lng: 3.4 } });
    state = reportFlowReducer(state, { type: "next" });
    state = reportFlowReducer(state, { type: "set-note", note: "Water across the lane" });
    state = reportFlowReducer(state, { type: "next" });
    expect(state.phase).toBe("review");
    state = reportFlowReducer(state, { type: "submit" });
    expect(state.phase).toBe("submitting");
    expect(reportFlowReducer(state, { type: "success" }).phase).toBe("success");
  });

  it("allows deliberate report-location changes and handles rejection", () => {
    let state = reportFlowReducer(startReportFlow(location), {
      type: "select-category",
      category: "road_hazard",
    });
    state = reportFlowReducer(state, { type: "set-location", location: { lat: 6.6, lng: 3.3 } });
    expect(state.location).toEqual({ lat: 6.6, lng: 3.3 });
    expect(reportErrorMessage({ code: "CR002" })).toContain("EXPIRED");
    expect(reportErrorMessage({ code: "22023" })).toContain("CATEGORY");
    expect(reportErrorMessage(new Error("private database detail"))).not.toContain(
      "private database",
    );
  });
});
