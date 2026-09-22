/**
 * Hand-maintained row types for the Supabase schema.
 *
 * These mirror supabase/migrations/*.sql. Until `supabase gen types typescript`
 * is available against a live project (requires the Supabase CLI + credentials
 * — see docs/ARCHITECTURE.md), these are maintained manually. If you change
 * the SQL schema, update this file in the same PR.
 */
import type {
  ConfirmationSignal,
  MessageModerationState,
  ModerationReason,
  ModerationStatus,
  ModerationTarget,
  ReportCategory,
  ReportCloseReason,
  ReportConfidence,
  ReportEventType,
  ReportLifecycle,
} from "@/types";

export interface DBAnonymousSessionRow {
  id: string;
  label: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string | null;
}

export interface DBReportRow {
  id: string;
  category: ReportCategory;
  location: unknown; /* geography(Point, 4326) — Postgres type, not JSON-serialisable */
  note: string | null;
  lifecycle: ReportLifecycle;
  confidence: ReportConfidence;
  session_id: string;
  created_at: string;
  updated_at: string;
  last_confirmed_at: string | null;
  expires_at: string;
  closed_at: string | null;
}

export interface DBReportConfirmationRow {
  id: string;
  report_id: string;
  session_id: string;
  signal: ConfirmationSignal;
  created_at: string;
}

export interface DBIncidentMessageRow {
  id: string;
  report_id: string;
  session_id: string;
  body: string;
  moderation_state: MessageModerationState;
  created_at: string;
}

export interface DBModerationFlagRow {
  id: string;
  target_type: ModerationTarget;
  report_id: string | null;
  message_id: string | null;
  reason: ModerationReason;
  note: string | null;
  status: ModerationStatus;
  session_id: string | null;
  created_at: string;
}

export interface DBReportEventRow {
  id: number;
  report_id: string;
  event_type: ReportEventType;
  session_id: string | null;
  message_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface DBActiveReportRow {
  id: string;
  category: ReportCategory;
  location: { lat: number; lng: number };
  note: string | null;
  lifecycle: ReportLifecycle;
  confidence: ReportConfidence;
  created_at: string;
  updated_at: string;
  expires_at: string;
  activator_label: string;
  still_dey: number;
  don_clear: number;
  participant_count: number;
  message_count: number;
}

export interface DBCloseReasonRow {
  reason: ReportCloseReason;
}

export interface DBLifecyclePolicyConfigRow {
  initial_lifetime: string;
  confirmation_extension: string;
  max_confirmations_counted: number;
  max_lifetime: string;
  stale_after: string;
  stale_grace: string;
  new_window: string;
  overnight_start_hour: number;
  don_clear_close_threshold: number;
  confidence_low_threshold: number;
  confidence_medium_threshold: number;
  confidence_high_threshold: number;
}

// NOTE: `supabase gen types typescript --linked` was run against the live
// (M0B.5-verified) project on 2026-09-22; the hand-maintained interfaces above
// were reconciled with its output (enums incl. MESSAGE_POSTED, confidence
// thresholds, active_reports return shape). Keep them in sync when the SQL
// schema changes.
