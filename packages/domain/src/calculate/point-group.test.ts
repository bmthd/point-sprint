import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculate } from "./calculate";
import { pointGroupOf } from "./point-group";

const SHOP_1 = "a0000000-0000-4000-8000-000000000001";
const SHOP_2 = "a0000000-0000-4000-8000-000000000002";

const benefit = (id: string, over: Partial<Benefit>): Benefit =>
  ({
    id,
    kind: "rate-bonus",
    category: "campaign",
    label: "benefit",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "plan",
    conditions: {},
    params: { rate: 1, roundingUnit: "item" },
    ...over,
  }) as Benefit;

const base = benefit("5b000000-0000-4000-8000-000000000001", { category: "base" });
const spu = benefit("5c000000-0000-4000-8000-000000000002", {
  category: "spu",
  params: { rate: 2, roundingUnit: "item" },
});
const campaign = benefit("5d000000-0000-4000-8000-000000000003", {
  params: { rate: 3, roundingUnit: "item" },
});
const shopAround = benefit("5e000000-0000-4000-8000-000000000004", {
  kind: "shop-around",
  params: { tiers: [{ minShops: 2, rate: 4 }], roundingUnit: "item" },
});

const shop = (id: string): Shop => ({
  id,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
});

describe("point groups", () => {
  test("maps sources to groups", () => {
    expect(pointGroupOf(base)).toBe("base");
    expect(pointGroupOf(spu)).toBe("spu");
    expect(pointGroupOf(campaign)).toBe("campaign");
    expect(pointGroupOf(shopAround)).toBe("marathon");
    expect(pointGroupOf("shop-rate")).toBe("campaign");
  });

  test("group totals sum to total", () => {
    const plan: Plan = {
      id: "f0000000-0000-4000-8000-000000000001",
      name: "plan",
      period: { start: "2026-10-01", end: "2026-10-31" },
      benefits: [base, spu, campaign, shopAround],
      orders: [SHOP_1, SHOP_2].map((shopId, index) => ({
        id: `0${index}000000-0000-4000-8000-000000000001`,
        shopId,
        date: "2026-10-05",
        // 1,100 yen incl. tax = 1,000 yen excl. tax. A shop rate of 2x adds +1.
        lineItems: [
          {
            id: `1${index}000000-0000-4000-8000-000000000001`,
            name: "item",
            unitPrice: 1100,
            quantity: 1,
            taxRate: 0.1 as const,
            discount: 0,
            shopPointRate: 2,
          },
        ],
        onHold: false,
        tags: [],
      })),
      updatedAt: "2026-10-04T00:00:00Z",
    };
    const result = calculate(plan, [shop(SHOP_1), shop(SHOP_2)]);
    // Per item: base 10, spu 20, campaign 30 + shop rate 10, marathon 40.
    expect(result.groupTotals).toEqual({ base: 20, spu: 40, campaign: 80, marathon: 80 });
    const sum = Object.values(result.groupTotals).reduce((acc, points) => acc + points, 0);
    expect(sum).toBe(result.total);
  });
});
