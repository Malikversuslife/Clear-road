import {
  isReportCategory,
  type GeoPoint,
  type ReportCategory,
  type ReportConfidence,
} from "@/types";

export interface CategoryMeta {
  category: ReportCategory;
  label: string;
  shortLabel: string;
  shape: "signal" | "gate" | "alert" | "bars" | "wave" | "diamond";
  tone: "coral" | "blue" | "lime";
}

export const SIGHTING_CATEGORIES: readonly CategoryMeta[] = [
  {
    category: "police_presence",
    label: "POLICE PRESENCE",
    shortLabel: "POLICE",
    shape: "signal",
    tone: "blue",
  },
  {
    category: "checkpoint_roadblock",
    label: "CHECKPOINT",
    shortLabel: "CHECKPOINT",
    shape: "gate",
    tone: "coral",
  },
  {
    category: "accident",
    label: "ACCIDENT",
    shortLabel: "ACCIDENT",
    shape: "alert",
    tone: "coral",
  },
  {
    category: "heavy_traffic",
    label: "HEAVY TRAFFIC",
    shortLabel: "TRAFFIC",
    shape: "bars",
    tone: "lime",
  },
  {
    category: "flooded_road",
    label: "FLOODED ROAD",
    shortLabel: "FLOOD",
    shape: "wave",
    tone: "blue",
  },
  {
    category: "road_hazard",
    label: "ROAD HAZARD",
    shortLabel: "HAZARD",
    shape: "diamond",
    tone: "lime",
  },
];

const categoryById = new Map(SIGHTING_CATEGORIES.map((meta) => [meta.category, meta]));

export function getCategoryMeta(category: ReportCategory): CategoryMeta {
  return categoryById.get(category) ?? SIGHTING_CATEGORIES[5];
}

export interface PublicSighting {
  id: string;
  category: ReportCategory;
  location: GeoPoint;
  note: string | null;
  lifecycle: "NEW" | "ACTIVE" | "RECENT" | "STALE";
  confidence: ReportConfidence;
  createdAt: Date;
  expiresAt: Date;
  reporterLabel: string;
  stillDeyCount: number;
  participantCount: number;
}

interface PublicSightingRow {
  id?: unknown;
  category?: unknown;
  location?: { lat?: unknown; lng?: unknown } | null;
  note?: unknown;
  lifecycle?: unknown;
  confidence?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  activator_label?: unknown;
  still_dey?: unknown;
  participant_count?: unknown;
}

const confidenceValues = new Set<ReportConfidence>(["UNCONFIRMED", "LOW", "MEDIUM", "HIGH"]);
const lifecycleValues = new Set<PublicSighting["lifecycle"]>(["NEW", "ACTIVE", "RECENT", "STALE"]);

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseReporterLabel(value: unknown): string {
  return typeof value === "string" && /^ANON \d{2}$/.test(value) ? value : "ANON";
}

export function mapPublicSighting(row: unknown): PublicSighting | null {
  if (!row || typeof row !== "object") return null;
  const value = row as PublicSightingRow;
  const location = value.location;
  const category = value.category as ReportCategory;
  const createdAt = parseDate(value.created_at);
  const expiresAt = parseDate(value.expires_at);
  if (
    typeof value.id !== "string" ||
    !isReportCategory(category) ||
    !location ||
    !finiteNumber(location.lat) ||
    !finiteNumber(location.lng) ||
    location.lat < -90 ||
    location.lat > 90 ||
    location.lng < -180 ||
    location.lng > 180 ||
    !createdAt ||
    !expiresAt ||
    !lifecycleValues.has(value.lifecycle as PublicSighting["lifecycle"]) ||
    !confidenceValues.has(value.confidence as ReportConfidence)
  ) {
    return null;
  }
  return {
    id: value.id,
    category,
    location: { lat: location.lat, lng: location.lng },
    note: typeof value.note === "string" ? value.note : null,
    lifecycle: value.lifecycle as PublicSighting["lifecycle"],
    confidence: value.confidence as ReportConfidence,
    createdAt,
    expiresAt,
    reporterLabel: parseReporterLabel(value.activator_label),
    stillDeyCount: finiteNumber(value.still_dey) ? value.still_dey : 0,
    participantCount: finiteNumber(value.participant_count) ? value.participant_count : 0,
  };
}

export function mapPublicSightings(rows: unknown): PublicSighting[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const sighting = mapPublicSighting(row);
    return sighting ? [sighting] : [];
  });
}

export function formatRelativeAge(createdAt: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR AGO`;
  return `${Math.floor(hours / 24)} DAY AGO`;
}

export function confidenceLabel(confidence: ReportConfidence): string {
  switch (confidence) {
    case "UNCONFIRMED":
      return "UNCONFIRMED REPORT";
    case "LOW":
      return "LOW COMMUNITY SIGNAL";
    case "MEDIUM":
      return "MEDIUM COMMUNITY SIGNAL";
    case "HIGH":
      return "HIGH COMMUNITY SIGNAL";
  }
}

export function visibleRadiusKm(latitudeDelta: number, longitudeDelta: number): number {
  const latitudeKm = Math.abs(latitudeDelta) * 111.32;
  const longitudeKm = Math.abs(longitudeDelta) * 111.32;
  return Math.max(3, Math.min(12, Math.ceil(Math.hypot(latitudeKm, longitudeKm) / 2)));
}

export function roundReportLocation(location: GeoPoint): GeoPoint {
  return {
    lat: Math.round(location.lat * 1_000_000) / 1_000_000,
    lng: Math.round(location.lng * 1_000_000) / 1_000_000,
  };
}

export function emptySightingsCopy(): { title: string; detail: string } {
  return {
    title: "NO RECENT SIGHTINGS HERE.",
    detail: "THAT DOESN'T MEAN THE ROAD IS CLEAR.",
  };
}
