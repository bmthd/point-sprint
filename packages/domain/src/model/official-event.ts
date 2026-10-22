import * as v from "valibot";
import { BenefitSchema } from "./benefit";
import { PeriodSchema } from "./common";

export const OfficialEventSchema = v.object({
  id: v.string(),
  name: v.string(),
  period: PeriodSchema,
  benefits: v.array(BenefitSchema),
  /**
   * Rakuten's page the event was read from, which the top page links to. Missing from a response
   * cached before the Worker served it.
   */
  url: v.optional(v.pipe(v.string(), v.url())),
});
export type OfficialEvent = v.InferOutput<typeof OfficialEventSchema>;
