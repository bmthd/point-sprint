import * as v from "valibot";
import { BenefitSchema } from "./benefit";
import { IdSchema, PeriodSchema, TimestampSchema } from "./common";
import { OrderSchema } from "./order";

export const PlanSchema = v.object({
  id: IdSchema,
  name: v.string(),
  officialEventId: v.optional(v.string()),
  period: PeriodSchema,
  benefits: v.array(BenefitSchema),
  orders: v.array(OrderSchema),
  updatedAt: TimestampSchema,
});
export type Plan = v.InferOutput<typeof PlanSchema>;

export const ProfileSchema = v.object({
  spuBenefits: v.array(BenefitSchema),
  updatedAt: TimestampSchema,
});
export type Profile = v.InferOutput<typeof ProfileSchema>;
