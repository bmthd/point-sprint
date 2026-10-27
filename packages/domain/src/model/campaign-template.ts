import * as v from "valibot";
import { BenefitSchema } from "../benefit-kinds";

export const CampaignTemplateSchema = v.object({
  id: v.string(),
  name: v.string(),
  occurrence: v.picklist(["fixed", "user-dates", "user-period"]),
  /**
   * A fixed campaign that only some members get (ご愛顧感謝デー), so the user adds it with what
   * they get, instead of every plan coming with it.
   */
  addedByUser: v.optional(v.literal(true)),
  benefit: BenefitSchema,
});
export type CampaignTemplate = v.InferOutput<typeof CampaignTemplateSchema>;

/** Whether every plan comes with this campaign (days ending in 5 or 0), instead of the user adding it. */
export function comesWithPlan(template: CampaignTemplate) {
  return template.occurrence === "fixed" && template.addedByUser !== true;
}
