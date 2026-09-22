import { z } from "zod";
import { REPORT_CATEGORIES, type ReportCategory } from "@/types";

/**
 * Report category helpers.
 */

export const reportCategorySchema = z.enum(REPORT_CATEGORIES, {
  error: "invalid report category",
});

export function parseReportCategory(
  value: unknown,
): { ok: true; value: ReportCategory } | { ok: false; error: string } {
  const result = reportCategorySchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
}
