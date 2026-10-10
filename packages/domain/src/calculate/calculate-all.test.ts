import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { LineItem, Order } from "../model/order";
import { DEFAULT_ACCOUNT_ID } from "../model/account";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculate, calculateAll } from "./calculate";
import type { CalculationResult } from "./types";

const SHOP_A = "a0000000-0000-4000-8000-000000000001";
const SHOP_B = "b0000000-0000-4000-8000-000000000002";

const PLAN_1 = "f0000000-0000-4000-8000-000000000001";
const PLAN_2 = "f0000000-0000-4000-8000-000000000002";
/** Sorts before the other plans. */
const PLAN_0 = "e0000000-0000-4000-8000-000000000001";

const ITEM_1 = "10000000-0000-4000-8000-000000000001";
const ITEM_2 = "20000000-0000-4000-8000-000000000002";
const ITEM_3 = "30000000-0000-4000-8000-000000000003";

const ORDER_1 = "01000000-0000-4000-8000-000000000001";
const ORDER_2 = "02000000-0000-4000-8000-000000000002";
const ORDER_3 = "03000000-0000-4000-8000-000000000003";

const ACCOUNT_2 = "acc00000-0000-4000-8000-000000000002";

const BONUS_ID = "5b000000-0000-4000-8000-000000000001";
const SHOP_AROUND_ID = "5a000000-0000-4000-8000-000000000002";

const shop = (id: string): Shop => ({
  id,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
});
const shops: Shop[] = [shop(SHOP_A), shop(SHOP_B)];

const item = (id: string, unitPrice: number, over: Partial<LineItem> = {}): LineItem => ({
  id,
  name: "item",
  unitPrice,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
  ...over,
});

/** 1,100 yen incl. tax = 1,000 yen excl. tax → 10 raw points at +1. */
const order = (id: string, itemId: string, date = "2026-10-05", shopId = SHOP_A): Order => ({
  id,
  shopId,
  date,
  lineItems: [item(itemId, 1100)],
  onHold: false,
  tags: [],
});

const bonus = (over: Partial<Benefit> & { cap?: number } = {}): Benefit => {
  const { cap, ...rest } = over;
  return {
    id: BONUS_ID,
    kind: "rate-bonus",
    category: "campaign",
    label: "bonus",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "plan",
    conditions: {},
    params: { rate: 1, roundingUnit: "item", ...(cap === undefined ? {} : { cap }) },
    ...rest,
  } as Benefit;
};

const plan = (id: string, orders: Order[], benefits: Benefit[]): Plan => ({
  id,
  name: "plan",
  period: { start: "2026-09-01", end: "2026-10-31" },
  benefits,
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
});

const resultOf = (results: Map<string, CalculationResult>, planId: string) => {
  const result = results.get(planId);
  if (!result) throw new Error(`no result for ${planId}`);
  return result;
};

const totalOf = (result: CalculationResult, benefitId = BONUS_ID) =>
  result.benefitTotals.find((t) => t.benefitId === benefitId);

const pointsOf = (result: CalculationResult, lineItemId: string, source = BONUS_ID) =>
  result.breakdown.find((row) => row.lineItemId === lineItemId && row.source === source)?.points;

function expectTotalsMatchBreakdown(results: Map<string, CalculationResult>) {
  for (const result of results.values()) {
    expect(result.total).toBe(result.breakdown.reduce((sum, row) => sum + row.points, 0));
  }
}

describe("calculateAll", () => {
  test("tax-included amount basis", () => {
    const p = plan(
      PLAN_1,
      [
        {
          id: ORDER_1,
          shopId: SHOP_A,
          date: "2026-10-05",
          lineItems: [item(ITEM_1, 3300)],
          onHold: false,
          tags: [],
        },
      ],
      [bonus({ amountBasis: "tax-included", params: { rate: 1, roundingUnit: "order" } })],
    );
    const results = calculateAll([p], shops);
    expect(resultOf(results, PLAN_1).total).toBe(33);
    expectTotalsMatchBreakdown(results);
  });

  test("month cap is shared across plans", () => {
    const b = bonus({ capScope: "month", cap: 15 });
    const results = calculateAll(
      [plan(PLAN_1, [order(ORDER_1, ITEM_1)], [b]), plan(PLAN_2, [order(ORDER_2, ITEM_2)], [b])],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    const r2 = resultOf(results, PLAN_2);
    expect(totalOf(r1)).toEqual({
      benefitId: BONUS_ID,
      rawPoints: 10,
      cappedPoints: 8,
      capReached: true,
    });
    expect(totalOf(r2)).toEqual({
      benefitId: BONUS_ID,
      rawPoints: 10,
      cappedPoints: 7,
      capReached: true,
    });
    expect(pointsOf(r1, ITEM_1)).toBe(8);
    expect(pointsOf(r2, ITEM_2)).toBe(7);
    expect(r1.warnings).toEqual([]);
    expectTotalsMatchBreakdown(results);
  });

  test("month cap resets across months", () => {
    const results = calculateAll(
      [
        plan(
          PLAN_1,
          [order(ORDER_1, ITEM_1, "2026-09-30"), order(ORDER_2, ITEM_2, "2026-10-01", SHOP_B)],
          [bonus({ capScope: "month", cap: 15 })],
        ),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    expect(r1.total).toBe(20);
    expect(totalOf(r1)).toEqual({
      benefitId: BONUS_ID,
      rawPoints: 20,
      cappedPoints: 20,
      capReached: false,
    });
    expectTotalsMatchBreakdown(results);
  });

  test("occurrence scope caps each occurrence separately", () => {
    const occurrence = (id: string, date: string) =>
      bonus({
        id,
        capScope: "occurrence",
        sharedKey: "sports-win",
        conditions: { dateRule: { type: "dates", dates: [date] } },
        cap: 15,
      });
    const results = calculateAll(
      [
        plan(
          PLAN_1,
          [
            order(ORDER_1, ITEM_1, "2026-10-05"),
            order(ORDER_2, ITEM_2, "2026-10-05", SHOP_B),
            order(ORDER_3, ITEM_3, "2026-10-06"),
          ],
          [occurrence(BONUS_ID, "2026-10-05"), occurrence(SHOP_AROUND_ID, "2026-10-06")],
        ),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    expect((pointsOf(r1, ITEM_1) ?? 0) + (pointsOf(r1, ITEM_2) ?? 0)).toBe(15);
    expect(pointsOf(r1, ITEM_3, SHOP_AROUND_ID)).toBe(10);
    expect(r1.total).toBe(25);
    expectTotalsMatchBreakdown(results);
  });

  test("plan scope is not shared", () => {
    const b = bonus({ capScope: "plan", cap: 15 });
    const results = calculateAll(
      [plan(PLAN_1, [order(ORDER_1, ITEM_1)], [b]), plan(PLAN_2, [order(ORDER_2, ITEM_2)], [b])],
      shops,
    );
    expect(resultOf(results, PLAN_1).total).toBe(10);
    expect(resultOf(results, PLAN_2).total).toBe(10);
    expect(totalOf(resultOf(results, PLAN_1))?.capReached).toBe(false);
    expectTotalsMatchBreakdown(results);
  });

  test("campaign scope shares one cap across plans", () => {
    const b = bonus({ capScope: "campaign", sharedKey: "marathon-2026-10", cap: 15 });
    const results = calculateAll(
      [
        plan(PLAN_1, [order(ORDER_1, ITEM_1, "2026-09-30")], [b]),
        plan(PLAN_2, [order(ORDER_2, ITEM_2, "2026-10-05")], [b]),
      ],
      shops,
    );
    expect(resultOf(results, PLAN_1).total + resultOf(results, PLAN_2).total).toBe(15);
    expectTotalsMatchBreakdown(results);
  });

  test("a shared cap goes to the earlier orders first", () => {
    const b = bonus({ capScope: "campaign", sharedKey: "marathon-2026-10", cap: 15 });
    const first = plan(PLAN_1, [order(ORDER_1, ITEM_1, "2026-10-05")], [b]);
    const alone = calculateAll([first], shops);
    // The second plan's id sorts first, but its order is later: it gets only what is left.
    const later = plan(PLAN_0, [order(ORDER_2, ITEM_2, "2026-10-20")], [b]);
    const results = calculateAll([later, first], shops);
    expect(resultOf(results, PLAN_1).total).toBe(resultOf(alone, PLAN_1).total);
    expect(pointsOf(resultOf(results, PLAN_1), ITEM_1)).toBe(10);
    expect(pointsOf(resultOf(results, PLAN_0), ITEM_2)).toBe(5);
    expectTotalsMatchBreakdown(results);
  });

  test("within one plan, the earlier order gets the cap first", () => {
    const results = calculateAll(
      [
        plan(
          PLAN_1,
          [order(ORDER_1, ITEM_1, "2026-10-06"), order(ORDER_2, ITEM_2, "2026-10-05", SHOP_B)],
          [bonus({ cap: 15 })],
        ),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    expect(pointsOf(r1, ITEM_2)).toBe(10);
    expect(pointsOf(r1, ITEM_1)).toBe(5);
    expectTotalsMatchBreakdown(results);
  });

  describe("accounts", () => {
    const sharedCases = [
      { capScope: "campaign", dates: ["2026-10-05", "2026-10-20"] },
      { capScope: "month", dates: ["2026-10-05", "2026-10-20"] },
      { capScope: "occurrence", dates: ["2026-10-05", "2026-10-06"] },
    ] as const;
    const twoPlans = (
      capScope: "campaign" | "month" | "occurrence",
      dates: readonly [string, string],
      accounts: [string | undefined, string | undefined],
    ) => {
      const b = bonus({ capScope, sharedKey: "shared", cap: 15 });
      const [first, second] = accounts;
      return calculateAll(
        [
          { ...plan(PLAN_1, [order(ORDER_1, ITEM_1, dates[0])], [b]), accountId: first },
          { ...plan(PLAN_2, [order(ORDER_2, ITEM_2, dates[1])], [b]), accountId: second },
        ],
        shops,
      );
    };

    test.each(sharedCases)(
      "$capScope cap is shared between plans of the same account",
      ({ capScope, dates }) => {
        const results = twoPlans(capScope, dates, [ACCOUNT_2, ACCOUNT_2]);
        expect(resultOf(results, PLAN_1).total + resultOf(results, PLAN_2).total).toBe(15);
        expectTotalsMatchBreakdown(results);
      },
    );

    test.each(sharedCases)(
      "$capScope cap applies to each account on its own",
      ({ capScope, dates }) => {
        const results = twoPlans(capScope, dates, [undefined, ACCOUNT_2]);
        expect(resultOf(results, PLAN_1).total).toBe(10);
        expect(resultOf(results, PLAN_2).total).toBe(10);
        expect(totalOf(resultOf(results, PLAN_1))?.capReached).toBe(false);
        expectTotalsMatchBreakdown(results);
      },
    );

    test("a plan with no account is the default account's", () => {
      const results = twoPlans(
        "month",
        ["2026-10-05", "2026-10-20"],
        [undefined, DEFAULT_ACCOUNT_ID],
      );
      expect(resultOf(results, PLAN_1).total + resultOf(results, PLAN_2).total).toBe(15);
    });
  });

  test("mismatched caps use the minimum and warn", () => {
    const results = calculateAll(
      [
        plan(PLAN_1, [order(ORDER_1, ITEM_1)], [bonus({ capScope: "month", cap: 15 })]),
        plan(PLAN_2, [order(ORDER_2, ITEM_2)], [bonus({ capScope: "month", cap: 12 })]),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    const r2 = resultOf(results, PLAN_2);
    expect(r1.total + r2.total).toBe(12);
    const warning = {
      type: "shared-cap-mismatch",
      groupKey: `month:${DEFAULT_ACCOUNT_ID}:${BONUS_ID}:2026-10`,
    };
    expect(r1.warnings).toEqual([warning]);
    expect(r2.warnings).toEqual([warning]);
    expectTotalsMatchBreakdown(results);
  });

  test("a cap on only one side of a shared group warns", () => {
    const results = calculateAll(
      [
        plan(PLAN_1, [order(ORDER_1, ITEM_1)], [bonus({ capScope: "month", cap: 15 })]),
        plan(PLAN_2, [order(ORDER_2, ITEM_2)], [bonus({ capScope: "month" })]),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    const r2 = resultOf(results, PLAN_2);
    expect(r1.total + r2.total).toBe(15);
    expect(r2.warnings).toEqual([
      { type: "shared-cap-mismatch", groupKey: `month:${DEFAULT_ACCOUNT_ID}:${BONUS_ID}:2026-10` },
    ]);
    expectTotalsMatchBreakdown(results);
  });

  test("calculate equals calculateAll for a single plan", () => {
    const shopAround: Benefit = {
      id: SHOP_AROUND_ID,
      kind: "shop-around",
      category: "campaign",
      label: "shop-around",
      enabled: true,
      amountBasis: "tax-excluded",
      capScope: "plan",
      conditions: {},
      params: { tiers: [{ minShops: 2, rate: 1 }], cap: 15, roundingUnit: "item" },
    };
    const p = plan(
      PLAN_1,
      [
        order(ORDER_1, ITEM_1),
        {
          id: ORDER_2,
          shopId: SHOP_B,
          date: "2026-10-05",
          lineItems: [item(ITEM_2, 1100, { shopPointRate: 3 })],
          onHold: false,
          tags: [],
        },
      ],
      [bonus(), shopAround],
    );
    const results = calculateAll([p], shops);
    expect(calculate(p, shops)).toEqual(resultOf(results, PLAN_1));
    expectTotalsMatchBreakdown(results);
  });
});
