import { z } from "zod";
import type { GeoPoint } from "@/types";

/**
 * Coordinate validation for reports.
 *
 * Rules:
 *  - latitudes must be finite numbers in [-90, 90]
 *  - longitudes must be finite numbers in [-180, 180]
 *  - malformed values are REJECTED, never silently coerced or clamped.
 *    Security-sensitive input is never "repaired".
 *  - sane precision: values with absurd precision are rejected (>6 decimals).
 */

export const LATITUDE_BOUNDS = { min: -90, max: 90 } as const;
export const LONGITUDE_BOUNDS = { min: -180, max: 180 } as const;
export const COORDINATE_MAX_DECIMALS = 6;

export const latSchema = z
  .number({ error: "latitude must be a number" })
  .finite("latitude must be finite")
  .min(LATITUDE_BOUNDS.min, "latitude must be >= -90")
  .max(LATITUDE_BOUNDS.max, "latitude must be <= 90")
  .refine((v) => maxDecimals(v), "latitude has excessive precision");

export const lngSchema = z
  .number({ error: "longitude must be a number" })
  .finite("longitude must be finite")
  .min(LONGITUDE_BOUNDS.min, "longitude must be >= -180")
  .max(LONGITUDE_BOUNDS.max, "longitude must be <= 180")
  .refine((v) => maxDecimals(v), "longitude has excessive precision");

function maxDecimals(v: number): boolean {
  if (!Number.isFinite(v)) return false;
  const [int, frac = ""] = String(v).split(".");
  if (int === "") return false;
  return frac.length <= COORDINATE_MAX_DECIMALS;
}

export const pointSchema = z
  .object(
    {
      lat: latSchema,
      lng: lngSchema,
    },
    { error: "location is required" },
  )
  .strict();

export type ValidatedPoint = z.infer<typeof pointSchema>;

export function parsePoint(
  value: unknown,
): { success: true; value: ValidatedPoint } | { success: false; error: string } {
  const result = pointSchema.safeParse(value);
  if (result.success) {
    return { success: true, value: result.data };
  }
  return { success: false, error: result.error.issues.map((i) => i.message).join("; ") };
}

export function isValidLatLng(value: unknown): value is GeoPoint {
  return pointSchema.safeParse(value).success;
}

/** Approximate bounding box of metropolitan Lagos used for region filtering. */
export const LAGOS_BOUNDS = {
  minLat: 6.34,
  maxLat: 6.75,
  minLng: 3.15,
  maxLng: 3.75,
} as const;

export function isInsideLagos(lat: number, lng: number): boolean {
  return (
    lat >= LAGOS_BOUNDS.minLat &&
    lat <= LAGOS_BOUNDS.maxLat &&
    lng >= LAGOS_BOUNDS.minLng &&
    lng <= LAGOS_BOUNDS.maxLng
  );
}

export function isPointInBounds(
  lat: number,
  lng: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): boolean {
  return (
    lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
  );
}
