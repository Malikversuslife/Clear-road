import type { ReportConfidence } from "@/types";

/**
 * Confidence model.
 *
 * Confidence must come from INDEPENDENT corroboration: each distinct session
 * that submits a STILL_DEY signal for a report counts once. The reporting
 * session's own signal is never counted (enforced in the DB layer by the
 * RPC that refuses the reporter's confirmation AND by this module when given
 * a count of independent signals).
 *
 * Confidence is deliberately separate from lifecycle:
 *   - lifecycle says "how relevant is this report right now" (time-based)
 *   - confidence says "how much corroboration does it have" (evidence-based)
 *
 * M0B uses a threshold count. M3 will weight recency, participants, and other
 * signals while keeping this same interface.
 */

export interface ConfidencePolicy {
  lowThreshold: number;
  mediumThreshold: number;
  highThreshold: number;
}

export const DEFAULT_CONFIDENCE_POLICY: ConfidencePolicy = {
  lowThreshold: 1,
  mediumThreshold: 2,
  highThreshold: 4,
};

export function computeConfidence(
  independentStillDeyCount: number,
  policy: Partial<ConfidencePolicy> = {},
): ReportConfidence {
  if (!Number.isInteger(independentStillDeyCount) || independentStillDeyCount < 0) {
    throw new RangeError(
      `independent confirmation count must be a non-negative integer, got ${independentStillDeyCount}`,
    );
  }
  const p: ConfidencePolicy = { ...DEFAULT_CONFIDENCE_POLICY, ...policy };
  if (independentStillDeyCount >= p.highThreshold) return "HIGH";
  if (independentStillDeyCount >= p.mediumThreshold) return "MEDIUM";
  if (independentStillDeyCount >= p.lowThreshold) return "LOW";
  return "UNCONFIRMED";
}

export const CONFIDENCE_RANK: Record<ReportConfidence, number> = {
  UNCONFIRMED: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/** Combine two confidence levels (e.g. after a moderation re-derivation). */
export function maxConfidence(a: ReportConfidence, b: ReportConfidence): ReportConfidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

export function isConfidenceAtLeast(level: ReportConfidence, threshold: ReportConfidence): boolean {
  return CONFIDENCE_RANK[level] >= CONFIDENCE_RANK[threshold];
}
