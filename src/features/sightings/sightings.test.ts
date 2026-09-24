import { describe, expect, it } from "vitest";
import {
  emptySightingsCopy,
  formatRelativeAge,
  mapPublicSighting,
  roundReportLocation,
  SIGHTING_CATEGORIES,
  visibleRadiusKm,
} from "./sightings";

describe("sighting category metadata", () => {
  it("covers the six existing report categories with distinct signal shapes", () => {
    expect(SIGHTING_CATEGORIES).toHaveLength(6);
    expect(new Set(SIGHTING_CATEGORIES.map((category) => category.shape)).size).toBe(6);
    expect(SIGHTING_CATEGORIES.map((category) => category.label)).toEqual([
      "POLICE PRESENCE",
      "CHECKPOINT",
      "ACCIDENT",
      "HEAVY TRAFFIC",
      "FLOODED ROAD",
      "ROAD HAZARD",
    ]);
  });
});

describe("public sighting mapping", () => {
  const now = new Date("2026-09-24T10:00:00.000Z");

  it("keeps only the sanitized public contract", () => {
    const sighting = mapPublicSighting({
      id: "report-1",
      category: "road_hazard",
      location: { lat: 6.52, lng: 3.38 },
      note: "Broken shoulder",
      lifecycle: "NEW",
      confidence: "UNCONFIRMED",
      created_at: "2026-09-24T09:52:00.000Z",
      expires_at: "2026-09-24T11:00:00.000Z",
      activator_label: "ANON 42",
      session_id: "must-not-escape",
      still_dey: 0,
      participant_count: 0,
    });
    expect(sighting).toMatchObject({
      id: "report-1",
      reporterLabel: "ANON 42",
      note: "Broken shoulder",
    });
    expect(sighting).not.toHaveProperty("session_id");
    expect(sighting && formatRelativeAge(sighting.createdAt, now)).toBe("8 MIN AGO");
  });

  it("rejects malformed public rows", () => {
    expect(mapPublicSighting({ id: "bad", category: "not-a-category" })).toBeNull();
  });
});

describe("sighting display helpers", () => {
  it("formats relative age without claiming safety", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");
    expect(formatRelativeAge(new Date("2026-09-24T10:00:00.000Z"), now)).toBe("JUST NOW");
    expect(formatRelativeAge(new Date("2026-09-24T09:00:00.000Z"), now)).toBe("1 HR AGO");
    expect(emptySightingsCopy()).toEqual({
      title: "NO RECENT SIGHTINGS HERE.",
      detail: "THAT DOESN'T MEAN THE ROAD IS CLEAR.",
    });
  });

  it("bounds map query radius to a sensible nearby range", () => {
    expect(visibleRadiusKm(0.01, 0.01)).toBe(3);
    expect(visibleRadiusKm(1, 1)).toBe(12);
  });

  it("rounds map-generated coordinates to the existing report contract", () => {
    expect(roundReportLocation({ lat: 6.5244001234, lng: 3.3792009876 })).toEqual({
      lat: 6.5244,
      lng: 3.379201,
    });
  });
});
