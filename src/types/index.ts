/**
 * Shared domain vocabulary for CLEAR ROAD.
 *
 * These enums are the single source of truth for allowed values. They are
 * mirrored in the database as PostgreSQL enums (see supabase/migrations) and
 * used by the zod validation schemas. Add values here, in the SQL enums, and
 * in the docs together.
 */

export const REPORT_CATEGORIES = [
  "police_presence",
  "checkpoint_roadblock",
  "accident",
  "heavy_traffic",
  "flooded_road",
  "road_hazard",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Lifecycle is TIME-BASED and stored on the report. See docs/DATA_MODEL.md. */
export const REPORT_LIFECYCLES = ["NEW", "ACTIVE", "RECENT", "STALE", "CLOSED"] as const;
export type ReportLifecycle = (typeof REPORT_LIFECYCLES)[number];

/** Confidence is a separate axis derived from independent corroboration. */
export const REPORT_CONFIDENCE_LEVELS = ["UNCONFIRMED", "LOW", "MEDIUM", "HIGH"] as const;
export type ReportConfidence = (typeof REPORT_CONFIDENCE_LEVELS)[number];

export const CONFIRMATION_SIGNALS = ["STILL_DEY", "DON_CLEAR"] as const;
export type ConfirmationSignal = (typeof CONFIRMATION_SIGNALS)[number];

export const REPORT_EVENT_TYPES = [
  "REPORT_CREATED",
  "CONFIRMATION_ADDED",
  "DON_CLEAR_ADDED",
  "MESSAGE_POSTED",
  "LIFECYCLE_CHANGED",
  "REPORT_CLOSED",
  "REPORT_REOPENED",
  "MODERATION_CHANGED",
] as const;
export type ReportEventType = (typeof REPORT_EVENT_TYPES)[number];

export const MODERATION_TARGETS = ["REPORT", "MESSAGE"] as const;
export type ModerationTarget = (typeof MODERATION_TARGETS)[number];

export const MODERATION_REASONS = [
  "SPAM",
  "HARASSMENT",
  "PERSONAL_INFORMATION",
  "DANGEROUS_CONTENT",
  "FALSE_REPORT",
  "ABUSE_OF_ANONYMITY",
  "OTHER",
] as const;
export type ModerationReason = (typeof MODERATION_REASONS)[number];

export const MODERATION_STATUSES = ["OPEN", "REVIEWED", "DISMISSED", "ACTIONED"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MESSAGE_MODERATION_STATES = ["VISIBLE", "HIDDEN", "REMOVED"] as const;
export type MessageModerationState = (typeof MESSAGE_MODERATION_STATES)[number];

export const REPORT_CLOSE_REASONS = ["DON_CLEAR", "EXPIRED", "MODERATED", "SUNRISE_RESET"] as const;
export type ReportCloseReason = (typeof REPORT_CLOSE_REASONS)[number];

export function isReportCategory(value: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}

/** Geographic position. Stored in the database as geography(Point, 4326). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A temporary, privacy-preserving anonymous session. */
export interface AnonymousSession {
  id: string;
  /** Human-readable display label, e.g. "ANON 82". Purely cosmetic. */
  label: string;
  createdAt: Date;
  /** Hard session expiry; expired sessions can no longer act. */
  expiresAt: Date;
  lastSeenAt: Date | null;
}

/** A crowdsourced road report. Claims, not established facts. */
export interface Report {
  id: string;
  category: ReportCategory;
  location: GeoPoint;
  note: string | null;
  lifecycle: ReportLifecycle;
  confidence: ReportConfidence;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  lastConfirmedAt: Date | null;
  expiresAt: Date;
  closedAt: Date | null;
}

/** One anonymous session's signal about a report. */
export interface ReportConfirmation {
  id: string;
  reportId: string;
  sessionId: string;
  signal: ConfirmationSignal;
  createdAt: Date;
}

/** A message in a report's temporary ROAD CHAT. */
export interface IncidentMessage {
  id: string;
  reportId: string;
  sessionId: string;
  body: string;
  moderationState: MessageModerationState;
  createdAt: Date;
}

/** A moderation flag against a report or a message. */
export interface ModerationFlag {
  id: string;
  targetType: ModerationTarget;
  reportId: string | null;
  messageId: string | null;
  reason: ModerationReason;
  note: string | null;
  status: ModerationStatus;
  sessionId: string | null;
  createdAt: Date;
}

/** Append-only audit of meaningful report state changes. */
export interface ReportEvent {
  id: number;
  reportId: string;
  eventType: ReportEventType;
  sessionId: string | null;
  messageId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

/** What the live product returns for a report. Never exposes session internals. */
export interface ActiveReport {
  id: string;
  category: ReportCategory;
  location: GeoPoint;
  note: string | null;
  lifecycle: ReportLifecycle;
  confidence: ReportConfidence;
  createdAt: Date;
  expiresAt: Date;
  lastConfirmedAt: Date | null;
  stillDeyCount: number;
  donClearCount: number;
  participantCount: number;
}
