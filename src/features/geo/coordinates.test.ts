import { describe, it, expect } from "vitest";
import {
  parsePoint,
  isValidLatLng,
  isInsideLagos,
  isPointInBounds,
  LAGOS_BOUNDS,
} from "@/features/geo/coordinates";

describe("parsePoint", () => {
  it("accepts a valid point", () => {
    const result = parsePoint({ lat: 6.5244, lng: 3.3792 });
    expect(result.success).toBe(true);
  });

  it("accepts boundary values", () => {
    expect(parsePoint({ lat: -90, lng: -180 }).success).toBe(true);
    expect(parsePoint({ lat: 90, lng: 180 }).success).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(parsePoint({ lat: 90.1, lng: 3 }).success).toBe(false);
    expect(parsePoint({ lat: 6, lng: 181 }).success).toBe(false);
    expect(parsePoint({ lat: -91, lng: 0 }).success).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(parsePoint({ lat: NaN, lng: 3 }).success).toBe(false);
    expect(parsePoint({ lat: 6, lng: Infinity }).success).toBe(false);
  });

  it("rejects excessive decimal precision", () => {
    expect(parsePoint({ lat: 6.12345678, lng: 3.3792 }).success).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(parsePoint(null).success).toBe(false);
    expect(parsePoint("6.5,3.3").success).toBe(false);
  });
});

describe("isValidLatLng", () => {
  it("is a type guard on valid points", () => {
    expect(isValidLatLng({ lat: 6.5, lng: 3.3 })).toBe(true);
    expect(isValidLatLng({ lat: 100, lng: 3.3 })).toBe(false);
  });
});

describe("Lagos bounds", () => {
  it("recognises points inside metropolitan Lagos", () => {
    expect(isInsideLagos(6.5244, 3.3792)).toBe(true);
    expect(isInsideLagos(LAGOS_BOUNDS.minLat, LAGOS_BOUNDS.minLng)).toBe(true);
  });

  it("rejects points outside", () => {
    expect(isInsideLagos(9.0, 7.5)).toBe(false);
    expect(isInsideLagos(6.0, 3.0)).toBe(false);
  });

  it("isPointInBounds works for an arbitrary box", () => {
    const box = { minLat: 0, maxLat: 10, minLng: -5, maxLng: 5 };
    expect(isPointInBounds(5, 0, box)).toBe(true);
    expect(isPointInBounds(15, 0, box)).toBe(false);
  });
});
