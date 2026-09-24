import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateReportInput } from "@/features/reports/validation";
import { mapPublicSightings, mapPublicSighting, type PublicSighting } from "./sightings";

export interface SightingsViewport {
  lat: number;
  lng: number;
  radiusKm: number;
}

export function isLatestViewportRequest(requestSequence: number, latestSequence: number): boolean {
  return requestSequence === latestSequence;
}

export async function fetchNearbySightings(
  client: SupabaseClient,
  viewport: SightingsViewport,
  signal?: AbortSignal,
): Promise<PublicSighting[]> {
  const request = client.rpc("active_reports", {
    p_lat: viewport.lat,
    p_lng: viewport.lng,
    p_radius_km: viewport.radiusKm,
  });
  const { data, error } = signal ? await request.abortSignal(signal) : await request;
  if (error) throw error;
  return mapPublicSightings(data);
}

export async function ensureAnonymousSession(client: SupabaseClient): Promise<void> {
  const { data: existing, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!existing.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await client.rpc("get_my_session");
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data)
    throw new Error("anonymous session unavailable");
}

export async function createSighting(
  client: SupabaseClient,
  input: CreateReportInput,
): Promise<PublicSighting> {
  await ensureAnonymousSession(client);
  const { data, error } = await client.rpc("create_report", {
    p_category: input.category,
    p_lat: input.location.lat,
    p_lng: input.location.lng,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  const sighting = mapPublicSighting(data);
  if (!sighting) throw new Error("invalid sighting response");
  return sighting;
}

export function reportErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  switch (code) {
    case "22023":
      return "CHECK THE CATEGORY, LOCATION, OR NOTE.";
    case "CR001":
    case "28000":
      return "ANONYMOUS SESSION COULD NOT START.";
    case "CR002":
      return "YOUR ANONYMOUS SESSION EXPIRED. TRY AGAIN.";
    default:
      return "SIGHTING COULD NOT BE SENT. TRY AGAIN.";
  }
}
