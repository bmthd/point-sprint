import * as v from "valibot";
import { BenefitSchema } from "./benefit";
import { PeriodSchema } from "./common";

export const OfficialEventSchema = v.object({
  id: v.string(),
  name: v.string(),
  period: PeriodSchema,
  benefits: v.array(BenefitSchema),
});
export type OfficialEvent = v.InferOutput<typeof OfficialEventSchema>;
