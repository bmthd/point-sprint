import type { Benefit } from "../benefit-kinds";

export { BenefitSchema } from "../benefit-kinds";
export type { Benefit } from "../benefit-kinds";

/** A two-shop campaign with its own days, outside the plan's shop-around outlook. */
export function isTwoShopCampaign(benefit: Benefit) {
  return benefit.kind === "shop-around" && benefit.campaignType === "two-shop";
}
