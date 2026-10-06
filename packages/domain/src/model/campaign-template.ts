import * as v from "valibot";
import { BenefitSchema } from "../benefit-kinds";

export const CampaignTemplateSchema = v.object({
  id: v.string(),
  name: v.string(),
  occurrence: v.picklist(["fixed", "user-dates", "user-period"]),
  benefit: BenefitSchema,
});
export type CampaignTemplate = v.InferOutput<typeof CampaignTemplateSchema>;
