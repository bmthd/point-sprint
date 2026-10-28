import * as v from "valibot";
import { BenefitSchema } from "./benefit";
import { IsoTimeSchema, PeriodSchema } from "./common";

export const OfficialEventSchema = v.object({
  id: v.string(),
  name: v.string(),
  period: PeriodSchema,
  /**
   * The time, in Japan, the period starts on its first day and ends on its last day, as `20:00` and
   * `01:59`. Missing when it is not known. Plans hold days only, so orders are not judged by it.
   */
  times: v.optional(v.object({ start: IsoTimeSchema, end: IsoTimeSchema })),
  benefits: v.array(BenefitSchema),
  /**
   * Rakuten's page the event was read from, which the top page links to. Missing from a response
   * cached before the Worker served it.
   */
  url: v.optional(v.pipe(v.string(), v.url())),
});
export type OfficialEvent = v.InferOutput<typeof OfficialEventSchema>;
