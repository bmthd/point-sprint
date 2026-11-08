import * as v from "valibot";
import { TimestampSchema } from "./common.ts";

/**
 * That one notice has been read: one row per notice, so two devices that read different notices
 * keep both when they sync. A row is never removed.
 */
export const NoticeReadSchema = v.object({
  /** The notice's id, its anchor on `/notices`. */
  id: v.string(),
  /** When it was read. */
  updatedAt: TimestampSchema,
});
export type NoticeRead = v.InferOutput<typeof NoticeReadSchema>;
