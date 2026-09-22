import { z } from "zod";
import { CONFIRMATION_SIGNALS, type ConfirmationSignal, type ReportLifecycle } from "@/types";

/**
 * Confirmation rules.
 *
 * Two community signals: STILL_DEY (still there) and DON_CLEAR (it's gone).
 *
 * Enforced invariants (also enforced in the DB — see the RPC functions and
 * unique constraints in supabase/migrations):
 *  1. A session may signal a given report at most ONCE
 *     (UNIQUE (report_id, session_id) + this module's duplicate rule).
 *  2. The reporting session can never confirm its own report.
 *  3. Only open, non-expired reports accept signals.
 *  4. `signal` must be a valid ConfirmationSignal — malformed input is
 *     rejected, never coerced (the DB enum enforces this as well).
 */

export const confirmationSignalSchema = z.enum(CONFIRMATION_SIGNALS, {
  error: "signal must be one of STILL_DEY or DON_CLEAR",
});

export interface ConfirmationInput {
  report:
    | {
        id: string;
        reporterSessionId: string;
        lifecycle: ReportLifecycle;
        closedAt: Date | null;
        expiresAt: Date | null;
      }
    | null
    | undefined;
  sessionId: string;
  signal: unknown;
  now: Date;
  /** Signals this session has already submitted for this report. */
  existingSignals: readonly ConfirmationSignal[];
  /** Whether the acting session is still valid (not expired). Default true. */
  sessionActive?: boolean;
}

export type ConfirmationRejectionCode =
  | "SESSION_INVALID"
  | "REPORT_NOT_FOUND"
  | "REPORT_CLOSED"
  | "REPORT_EXPIRED"
  | "SELF_CONFIRMATION"
  | "DUPLICATE_SIGNAL"
  | "INVALID_SIGNAL";

export type ConfirmationVerdict =
  { ok: true; signal: ConfirmationSignal } | { ok: false; code: ConfirmationRejectionCode };

export function isSelfConfirmation(sessionId: string, reporterSessionId: string): boolean {
  return sessionId.length > 0 && sessionId === reporterSessionId;
}

export function evaluateConfirmation(input: ConfirmationInput): ConfirmationVerdict {
  const parsed = confirmationSignalSchema.safeParse(input.signal);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_SIGNAL" };
  }
  const signal = parsed.data;

  if (input.sessionActive === false) {
    return { ok: false, code: "SESSION_INVALID" };
  }

  if (!input.report) {
    return { ok: false, code: "REPORT_NOT_FOUND" };
  }

  if (input.report.lifecycle === "CLOSED" || input.report.closedAt) {
    return { ok: false, code: "REPORT_CLOSED" };
  }

  if (input.report.expiresAt && input.now.getTime() >= input.report.expiresAt.getTime()) {
    return { ok: false, code: "REPORT_EXPIRED" };
  }

  if (isSelfConfirmation(input.sessionId, input.report.reporterSessionId)) {
    return { ok: false, code: "SELF_CONFIRMATION" };
  }

  if (input.existingSignals.length > 0) {
    return { ok: false, code: "DUPLICATE_SIGNAL" };
  }

  return { ok: true, signal };
}

/** Whether the accumulated DON_CLEAR signals are enough to close the report. */
export function shouldCloseReport(donClearCount: number, threshold = 1): boolean {
  return donClearCount >= threshold;
}
