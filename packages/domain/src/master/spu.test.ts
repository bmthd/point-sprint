import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { calculate } from "../calculate/calculate";
import { PlanSchema } from "../model/plan";
import { ShopSchema } from "../model/shop";
import type { Benefit } from "../model/benefit";
import { BANK_CARD_ID, BANK_SALARY_ID, standardSpu } from "./spu";

const shops = [
  v.parse(ShopSchema, {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "shop",
    channel: "rakuten-ichiba",
    tags: [],
    updatedAt: "2026-10-04T00:00:00Z",
  }),
];
const orders = [
  {
    id: "01000000-0000-4000-8000-000000000001",
    shopId: shops[0]?.id,
    date: "2026-10-05",
    lineItems: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        name: "item",
        unitPrice: 10000,
        quantity: 1,
        taxRate: 0.1,
        discount: 0,
      },
    ],
    onHold: false,
    tags: [],
  },
];
const plan = (benefits: Benefit[]) =>
  v.parse(PlanSchema, {
    id: "f0000000-0000-4000-8000-000000000001",
    name: "plan",
    period: { start: "2026-10-04", end: "2026-10-11" },
    benefits,
    orders,
    updatedAt: "2026-10-04T00:00:00Z",
  });

describe("楽天銀行 SPU", () => {
  /** The standard SPU with only 通常ポイント and the given 楽天銀行 tier on. */
  const withBank = (bankId: string) =>
    structuredClone(standardSpu).map((benefit) => ({
      ...benefit,
      enabled: benefit.label === "通常ポイント" || benefit.id === bankId,
    }));

  test("the card-payment tier adds +0.3", () => {
    const result = calculate(plan(withBank(BANK_CARD_ID)), shops);
    expect(
      result.benefitTotals.find((total) => total.benefitId === BANK_CARD_ID)?.cappedPoints,
    ).toBe(27);
    expect(result.total).toBe(117);
  });

  test("the salary tier adds +0.5", () => {
    const result = calculate(plan(withBank(BANK_SALARY_ID)), shops);
    expect(
      result.benefitTotals.find((total) => total.benefitId === BANK_SALARY_ID)?.cappedPoints,
    ).toBe(45);
    expect(result.total).toBe(135);
  });
});
