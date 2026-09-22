import { z } from "zod";

/**
 * ROAD CHAT message foundation (no UI in M0B).
 *
 * Each active report has a temporary chat tied to that incident only. No DMs,
 * no global chat, no public profiles. When an incident closes, its chat stops
 * accepting normal user messages (enforced here AND in the DB RPC).
 */

export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 500;

export const messageBodySchema = z
  .string({ error: "message body must be a string" })
  .trim()
  .min(MESSAGE_MIN_LENGTH, "message cannot be empty")
  .max(MESSAGE_MAX_LENGTH, `message cannot exceed ${MESSAGE_MAX_LENGTH} characters`);

export type ValidatedMessageBody = z.infer<typeof messageBodySchema>;

export type MessagePostVerdict =
  | { ok: true; body: string }
  | { ok: false; code: "INVALID_BODY" | "REPORT_CLOSED" | "REPORT_EXPIRED" | "SESSION_INVALID" };

export interface PostMessageInput {
  body: unknown;
  reportOpen: boolean;
  reportExpired: boolean;
  sessionActive: boolean;
}

export function evaluateMessagePost(input: PostMessageInput): MessagePostVerdict {
  if (input.sessionActive === false) {
    return { ok: false, code: "SESSION_INVALID" };
  }
  if (!input.reportOpen) {
    return { ok: false, code: "REPORT_CLOSED" };
  }
  if (input.reportExpired) {
    return { ok: false, code: "REPORT_EXPIRED" };
  }
  const parsed = messageBodySchema.safeParse(input.body);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_BODY" };
  }
  return { ok: true, body: parsed.data };
}
