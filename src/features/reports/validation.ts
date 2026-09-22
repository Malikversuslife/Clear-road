import { z } from "zod";
import { pointSchema } from "@/features/geo/coordinates";
import { reportCategorySchema } from "@/features/reports/categories";

/**
 * Report input validation. All client-supplied report data passes through
 * these schemas before reaching the DB RPC. The DB RPC enforces the same
 * constraints again (defence in depth) — see supabase/migrations.
 */

export const NOTE_MAX_LENGTH = 280;

export const reportNoteSchema = z
  .string({ error: "note must be a string" })
  .trim()
  .max(NOTE_MAX_LENGTH, `note cannot exceed ${NOTE_MAX_LENGTH} characters`)
  .transform((v) => (v.length === 0 ? null : v))
  .pipe(z.string().min(1).max(NOTE_MAX_LENGTH).nullable());

export const createReportInputSchema = z
  .object(
    {
      category: reportCategorySchema,
      location: pointSchema,
      note: reportNoteSchema.optional(),
    },
    { error: "invalid report payload" },
  )
  .strict();

export type CreateReportInput = z.infer<typeof createReportInputSchema>;

export function validateCreateReport(
  value: unknown,
): { ok: true; value: CreateReportInput } | { ok: false; error: string } {
  const result = createReportInputSchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
}
