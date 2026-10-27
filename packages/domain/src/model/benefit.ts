import type { Benefit } from "../benefit-kinds";

export { BenefitSchema } from "../benefit-kinds";
export type { Benefit } from "../benefit-kinds";

/** A two-shop campaign with its own days, outside the plan's shop-around outlook. */
export const isTwoShopCampaign = (benefit: Benefit) =>
  benefit.kind === "shop-around" && benefit.campaignType === "two-shop";
