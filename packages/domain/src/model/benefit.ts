import type { Benefit } from "#/benefit-kinds/index.ts";

export { BenefitSchema } from "#/benefit-kinds/index.ts";
export type { Benefit } from "#/benefit-kinds/index.ts";

/** A two-shop campaign with its own days, outside the plan's shop-around outlook. */
export function isTwoShopCampaign(benefit: Benefit) {
  return benefit.kind === "shop-around" && benefit.campaignType === "two-shop";
}
