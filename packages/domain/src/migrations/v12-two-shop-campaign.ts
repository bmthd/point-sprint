import type { Migration } from "./runner";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Preserve the old two-shop classification without tying calculations to shared-cap keys. */
const withCampaignType = (row: unknown): unknown => {
  if (!isRow(row) || !Array.isArray(row.benefits)) return row;
  return {
    ...row,
    benefits: row.benefits.map((benefit) =>
      isRow(benefit) &&
      benefit.kind === "shop-around" &&
      typeof benefit.sharedKey === "string" &&
      benefit.sharedKey.startsWith("2shop:")
        ? { ...benefit, campaignType: "two-shop" }
        : benefit,
    ),
  };
};

export const twoShopCampaignMigration: Migration = {
  to: 12,
  stores: { plans: withCampaignType },
};
