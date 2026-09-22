import { z } from "zod";
import {
  MODERATION_REASONS,
  MODERATION_TARGETS,
  type ModerationReason,
  type ModerationTarget,
} from "@/types";

/**
 * Moderation foundation (data layer only; no admin UI in M0B).
 *
 * Intended future handling: spam, harassment, personal information,
 * dangerous content, intentionally false reports, and abuse of anonymity.
 * M0B provides the validated input shape + the DB schema/RLS; the review
 * workflow arrives later.
 */

export const FLAG_NOTE_MAX_LENGTH = 200;

export const moderationReasonSchema = z.enum(MODERATION_REASONS, {
  error: "invalid moderation reason",
});
export const moderationTargetSchema = z.enum(MODERATION_TARGETS, {
  error: "invalid flag target",
});

export const flagNoteSchema = z
  .string({ error: "flag note must be a string" })
  .trim()
  .max(FLAG_NOTE_MAX_LENGTH, `flag note cannot exceed ${FLAG_NOTE_MAX_LENGTH} characters`)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const reportIdSchema = z.uuid("report id must be a valid UUID");
export const messageIdSchema = z.uuid("message id must be a valid UUID");

export const flagInputSchema = z
  .object(
    {
      targetType: moderationTargetSchema,
      reportId: reportIdSchema.nullable().optional(),
      messageId: messageIdSchema.nullable().optional(),
      reason: moderationReasonSchema,
      note: flagNoteSchema,
      sessionId: z.string().min(1).optional(),
    },
    { error: "invalid flag payload" },
  )
  .strict()
  .superRefine((value, ctx) => {
    const hasReport = value.reportId != null;
    const hasMessage = value.messageId != null;
    if (value.targetType === "REPORT" && !hasReport) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "report flags require a report id",
        path: ["reportId"],
      });
    }
    if (value.targetType === "MESSAGE" && !hasMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "message flags require a message id",
        path: ["messageId"],
      });
    }
    if (hasReport && hasMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exactly one of reportId or messageId must be set",
        path: ["reportId"],
      });
    }
  });

export function parseFlagReason(
  value: unknown,
): { ok: true; value: ModerationReason } | { ok: false; error: string } {
  const result = moderationReasonSchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
}

export function parseFlagTarget(
  value: unknown,
): { ok: true; value: ModerationTarget } | { ok: false; error: string } {
  const result = moderationTargetSchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
}
