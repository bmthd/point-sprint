import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculateAll } from "./calculate";
import { capLines } from "./cap-lines";

const SHOP = "a0000000-0000-4000-8000-000000000001";
const FIRST = "f0000000-0000-4000-8000-000000000001";
const SECOND = "f0000000-0000-4000-8000-000000000002";
const OTHER_ACCOUNT = "acc00000-0000-4000-8000-000000000002";
const CARD = "5b000000-0000-4000-8000-000000000001";
const MARATHON = "5a000000-0000-4000-8000-000000000002";

const shops: Shop[] = [
  {
    id: SHOP,
    channel: "rakuten-ichiba",
    name: "shop",
    tags: [],
    updatedAt: "2026-10-04T00:00:00Z",
  },
];

/** +1倍, at most 100P a month, shared between plans by `sharedKey`. */
const card: Benefit = {
  id: CARD,
  kind: "rate-bonus",
  category: "spu",
  label: "楽天カード特典分",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "month",
  sharedKey: "card",
  params: { rate: 1, roundingUnit: "item", cap: 100 },
};

/** +1倍 from 2 shops, at most 50P in the plan. */
const marathon: Benefit = {
  id: MARATHON,
  kind: "shop-around",
  category: "campaign",
  label: "お買い物マラソン",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { tiers: [{ minShops: 2, rate: 1 }], roundingUnit: "item", cap: 50 },
};

/** One order of `taxIncluded` yen at 10%. */
const order = (id: string, date: string, taxIncluded: number, onHold = false): Order => ({
  id: `0${id}000000-0000-4000-8000-000000000001`,
  shopId: SHOP,
  date,
  lineItems: [
    {
      id: `${id}0000000-0000-4000-8000-000000000001`,
      name: "",
      unitPrice: taxIncluded,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold,
  tags: [],
});

const plan = (
  id: string,
  start: string,
  end: string,
  orders: Order[],
  over: Partial<Plan> = {},
): Plan => ({
  id,
  name: id,
  period: { start, end },
  benefits: [card, marathon],
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
  ...over,
});

const linesOf = (plans: Plan[], target: Plan, day?: string) => {
  const result = calculateAll(plans, shops).get(target.id);
  if (!result) throw new Error("no result");
  return capLines(target, result, day);
};

const cardLines = (plans: Plan[], target: Plan) =>
  linesOf(plans, target).filter((line) => line.benefit.id === CARD);

describe("capLines", () => {
  test("another plan's use of a shared month cap counts against a plan with no orders", () => {
    // 3,300 yen incl. tax → 3,000 excl. → 30P of the card's 100P in October.
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const second = plan(SECOND, "2026-10-20", "2026-10-25", []);
    expect(cardLines([first, second], second)).toEqual([
      expect.objectContaining({
        scope: "month",
        period: "2026-10",
        cap: 100,
        usedHere: 0,
        usedElsewhere: 30,
        sharedWith: [FIRST],
        raw: 30,
        remaining: 70,
        rate: 1,
      }),
    ]);
  });

  test("a held order is not counted as used", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300, true)]);
    expect(cardLines([first], first)).toEqual([
      expect.objectContaining({ usedHere: 0, usedElsewhere: 0, remaining: 100 }),
    ]);
  });

  test("another account's plan does not use the cap", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      accountId: OTHER_ACCOUNT,
    });
    const second = plan(SECOND, "2026-10-20", "2026-10-25", []);
    expect(cardLines([first, second], second)).toEqual([
      expect.objectContaining({ usedElsewhere: 0, sharedWith: [], remaining: 100 }),
    ]);
  });

  test("a plan across two months has a month line for each", () => {
    const across = plan(FIRST, "2026-09-28", "2026-10-03", [order("1", "2026-10-01", 3300)]);
    expect(cardLines([across], across).map((line) => [line.period, line.remaining])).toEqual([
      ["2026-09", 100],
      ["2026-10", 70],
    ]);
  });

  test("a plan across a new year has a month line for each", () => {
    const across = plan(FIRST, "2026-12-28", "2027-01-03", []);
    expect(cardLines([across], across).map((line) => line.period)).toEqual(["2026-12", "2027-01"]);
  });

  test("a capped benefit whose rate is 0 now still has a line", () => {
    // One shop: the marathon's rate is 0, so no amount fills its cap yet.
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const lines = linesOf([first], first).filter((line) => line.benefit.id === MARATHON);
    expect(lines).toEqual([
      expect.objectContaining({ scope: "plan", period: null, cap: 50, rate: 0, remaining: 50 }),
    ]);
  });

  test("a day cap is today's in the period, else the first day's", () => {
    const daily: Benefit = { ...card, capScope: "day" };
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      benefits: [daily],
    });
    expect(linesOf([first], first, "2026-10-05")).toEqual([
      expect.objectContaining({ period: "2026-10-05", remaining: 70 }),
    ]);
    expect(linesOf([first], first, "2026-11-01")).toEqual([
      expect.objectContaining({ period: "2026-10-04", remaining: 100 }),
    ]);
    expect(linesOf([first], first, undefined)).toEqual([
      expect.objectContaining({ period: "2026-10-04" }),
    ]);
  });

  test("benefits without a cap, and disabled ones, have no line", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [], {
      benefits: [
        { ...card, params: { rate: 1, roundingUnit: "item" } },
        { ...marathon, enabled: false },
      ],
    });
    expect(linesOf([first], first)).toEqual([]);
  });
});
