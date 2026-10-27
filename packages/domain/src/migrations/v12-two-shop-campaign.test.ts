import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { calculate } from "../calculate/calculate";
import { PlanSchema } from "../model/plan";
import { syncSchemas } from "../sync/records";
import { migrateRow } from "./index";

const benefit = {
  id: "10000000-0000-4000-8000-000000000001",
  kind: "shop-around",
  category: "campaign",
  label: "2ショップ購入",
  enabled: true,
  conditions: { dateRule: { type: "range", start: "2026-10-04", end: "2026-10-05" } },
  amountBasis: "tax-excluded",
  capScope: "occurrence",
  sharedKey: "2shop:2026-10-04",
  params: { tiers: [{ minShops: 2, rate: 2 }], cap: 3000, roundingUnit: "item" },
};
const row = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "plan",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: [benefit],
  updatedAt: "2026-10-05T00:00:00.000Z",
};
const shops = [1, 2].map((n) => ({
  id: `30000000-0000-4000-8000-00000000000${n}`,
  name: "shop",
  channel: "rakuten-ichiba" as const,
  tags: [],
  updatedAt: row.updatedAt,
}));
const orders = shops.map((shop, n) => ({
  id: `40000000-0000-4000-8000-00000000000${n}`,
  shopId: shop.id,
  date: "2026-10-04",
  onHold: false,
  tags: [],
  lineItems: [
    {
      id: `50000000-0000-4000-8000-00000000000${n}`,
      name: "item",
      unitPrice: 11000,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
}));

describe("two-shop campaigns", () => {
  test("a saved two-shop keeps its points and stays outside the plan outlook", () => {
    const migrated = migrateRow("plans", row, 11);
    expect(migrated).toEqual({ ...row, benefits: [{ ...benefit, campaignType: "two-shop" }] });
    const plan = v.parse(PlanSchema, { ...v.parse(syncSchemas.plan, migrated), orders });
    const result = calculate(plan, shops);
    expect(result.total).toBe(400);
    expect(result.rates[benefit.id]).toBe(2);
    expect(result.shopAroundOutlook).toBeNull();
    const renamed = {
      ...plan,
      benefits: plan.benefits.map((b) => ({ ...b, sharedKey: "renamed" })),
    };
    expect(calculate(renamed, shops).shopAroundOutlook).toBeNull();
    expect(calculate(renamed, shops).total).toBe(400);
  });

  test("a migrated two-shop does not replace the main shop-around outlook", () => {
    const main = {
      ...benefit,
      id: "60000000-0000-4000-8000-000000000001",
      sharedKey: "shop-around",
      params: { ...benefit.params, tiers: [{ minShops: 2, rate: 1 }] },
    };
    const migrated = migrateRow("plans", { ...row, benefits: [benefit, main] }, 11);
    const plan = v.parse(PlanSchema, { ...v.parse(syncSchemas.plan, migrated), orders });
    const result = calculate(plan, shops);
    expect(result.total).toBe(600);
    expect(result.shopAroundOutlook?.benefitId).toBe(main.id);
    const ordinary = v.parse(PlanSchema, { ...row, orders });
    expect(calculate(ordinary, shops).shopAroundOutlook?.benefitId).toBe(benefit.id);
  });

  test("other benefits and unreadable rows are left alone", () => {
    for (const value of [
      null,
      "broken",
      {},
      {
        benefits: [
          null,
          "broken",
          { ...benefit, kind: "rate-bonus" },
          { ...benefit, sharedKey: "shop-around" },
          { ...benefit, sharedKey: "2shop" },
        ],
      },
    ]) {
      expect(migrateRow("plans", value, 11)).toEqual(value);
    }
    expect(migrateRow("shops", row, 11)).toEqual(row);
  });

  test("running the migration again leaves the same row", () => {
    const migrated = migrateRow("plans", row, 11);
    expect(migrateRow("plans", migrated, 11)).toEqual(migrated);
  });
});
