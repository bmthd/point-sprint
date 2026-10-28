import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculateAll } from "./calculate";
import { capLines, capRows, fillPrice } from "./cap-lines";

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
const order = (
  id: string,
  date: string,
  taxIncluded: number,
  onHold = false,
  tags: Order["tags"] = [],
): Order => ({
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
  tags,
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

const linesOf = (plans: Plan[], target: Plan) => {
  const result = calculateAll(plans, shops).get(target.id);
  if (!result) throw new Error("no result");
  return capLines(target, result);
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

  test("each occurrence cap has its own line, with its first day", () => {
    const occurrence = (id: string, date: string): Benefit => ({
      ...card,
      id,
      capScope: "occurrence",
      sharedKey: "sports-win",
      conditions: { dateRule: { type: "dates", dates: [date] } },
    });
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      benefits: [occurrence(CARD, "2026-10-05"), occurrence(MARATHON, "2026-10-06")],
    });
    expect(linesOf([first], first)).toEqual([
      expect.objectContaining({ scope: "occurrence", period: "2026-10-05", remaining: 70 }),
      expect.objectContaining({ scope: "occurrence", period: "2026-10-06", remaining: 100 }),
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

  test("a month cap has a line only in the months its days are in the period", () => {
    const firstDay: Benefit = {
      ...card,
      conditions: { dateRule: { type: "daysOfMonth", days: [1] } },
    };
    const without = plan(FIRST, "2026-10-24", "2026-10-27", [], { benefits: [firstDay] });
    expect(linesOf([without], without)).toEqual([]);
    const across = plan(FIRST, "2026-10-28", "2026-11-03", [], { benefits: [firstDay] });
    expect(linesOf([across], across).map((line) => line.period)).toEqual(["2026-11"]);
  });

  test("an occurrence cap whose days are outside the period has no line", () => {
    const later: Benefit = {
      ...card,
      capScope: "occurrence",
      conditions: { dateRule: { type: "dates", dates: ["2026-10-25"] } },
    };
    const before = plan(FIRST, "2026-10-04", "2026-10-09", [], { benefits: [later] });
    expect(linesOf([before], before)).toEqual([]);
  });
});

/** 楽天ブランドデー: +2倍, +4倍 from ¥30,000 of brand-day orders, at most 4,000P. */
const brandDay: Benefit = {
  id: "5d000000-0000-4000-8000-000000000001",
  kind: "spend-tiers",
  category: "campaign",
  label: "ブランドデー",
  enabled: true,
  conditions: { orderTags: ["brand-day"] },
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: {
    tiers: [
      { minAmount: 0, rate: 2 },
      { minAmount: 30000, rate: 4 },
    ],
    cap: 4000,
    roundingUnit: "item",
  },
};

describe("fillPrice", () => {
  const brandPlan = (orders: Order[], benefits = [brandDay]) =>
    plan(FIRST, "2026-10-20", "2026-10-21", orders, { benefits });
  const brandOrder = (id: string, price: number) =>
    order(id, "2026-10-20", price, false, ["brand-day"]);
  const pointsWith = (orders: Order[]) => {
    const target = brandPlan(orders);
    const [found] = linesOf([target], target);
    return found?.usedHere;
  };

  test("a rate-bonus cap is filled at its rate", () => {
    // 30P of 100P used: 70P more at +1倍 is ¥7,000 excl. tax, ¥7,699 incl. 10%.
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const [cardLine] = cardLines([first], first);
    expect(cardLine && fillPrice(cardLine, 0.1)).toBe(7699);
  });

  test("a spend-tiers cap is filled at the tier the price reaches", () => {
    const empty = brandPlan([]);
    const [emptyLine] = linesOf([empty], empty);
    // +4倍 from ¥30,000: 4,000P is ¥100,000 excl. tax, ¥109,999 incl.
    expect(emptyLine && fillPrice(emptyLine, 0.1)).toBe(109999);
    expect(pointsWith([brandOrder("2", 109999)])).toBe(4000);

    const bought = brandPlan([brandOrder("1", 12000)]);
    const [boughtLine] = linesOf([bought], bought);
    const price = (boughtLine && fillPrice(boughtLine, 0.1)) ?? 0;
    expect(pointsWith([brandOrder("1", 12000), brandOrder("2", price)])).toBe(4000);
    expect(pointsWith([brandOrder("1", 12000), brandOrder("2", price - 1)])).toBeLessThan(4000);
  });

  test("a spend-tiers cap below its first tier is filled from the first tier", () => {
    const tiers = [{ minAmount: 3000, rate: 2 }];
    const wonderful: Benefit = {
      ...brandDay,
      conditions: {},
      params: { tiers, cap: 1000, roundingUnit: "item" },
    };
    const empty = brandPlan([], [wonderful]);
    const [emptyLine] = linesOf([empty], empty);
    // 1,000P at +2倍 is ¥50,000 excl. tax, ¥54,999 incl.
    expect(emptyLine && fillPrice(emptyLine, 0.1)).toBe(54999);
    // 10P at +2倍 is ¥549, but nothing is given below ¥3,000.
    const small = brandPlan(
      [],
      [{ ...wonderful, params: { tiers, cap: 10, roundingUnit: "item" } }],
    );
    const [smallLine] = linesOf([small], small);
    expect(smallLine && fillPrice(smallLine, 0.1)).toBe(3000);
  });

  test("one order must be at least the minimum order amount", () => {
    const minimum: Benefit = { ...card, capScope: "plan", conditions: { minOrderAmount: 3980 } };
    const small = plan(FIRST, "2026-10-04", "2026-10-09", [], {
      benefits: [{ ...minimum, params: { rate: 1, roundingUnit: "item", cap: 10 } }],
    });
    const [smallLine] = linesOf([small], small);
    // 10P at +1倍 is ¥1,099, but the order has to be ¥3,980 or more.
    expect(smallLine && fillPrice(smallLine, 0.1)).toBe(3980);
  });

  test("a cap whose rate is 0 cannot be filled", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const [marathonLine] = linesOf([first], first).filter((line) => line.benefit.id === MARATHON);
    expect(marathonLine && fillPrice(marathonLine, 0.1)).toBeNull();
  });
});

describe("capRows", () => {
  /** +`rate`倍, at most `cap`P in October. */
  const spu = (id: string, rate: number, cap: number): Benefit => ({
    ...card,
    id: `5e000000-0000-4000-8000-00000000000${id}`,
    label: `spu${id}`,
    sharedKey: undefined,
    params: { rate, roundingUnit: "item", cap },
  });
  const labelsOf = (target: Plan) => {
    const result = calculateAll([target], shops).get(target.id);
    if (!result) throw new Error("no result");
    return capRows(capLines(target, result), 0.1).map((row) => ({
      labels: row.lines.map((line) => line.benefit.label),
      price: row.price,
    }));
  };

  test("the cap the least money fills comes first, and the filled caps come last", () => {
    // ¥3,300 earns 30P at +1倍 and 15P at +0.5倍: the 20P cap is filled.
    const target = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      benefits: [spu("1", 1, 20), spu("2", 1, 1000), spu("3", 0.5, 100), marathon],
    });
    expect(labelsOf(target)).toEqual([
      { labels: ["spu3"], price: 18699 },
      { labels: ["spu2"], price: 106699 },
      { labels: ["お買い物マラソン"], price: null },
      { labels: ["spu1"], price: 0 },
    ]);
  });

  test("caps with the same price, cap, use and days are one row", () => {
    const same = plan(FIRST, "2026-10-04", "2026-10-09", [], {
      benefits: [spu("1", 0.5, 1000), spu("2", 1, 1000), spu("3", 0.5, 1000)],
    });
    expect(labelsOf(same)).toEqual([
      { labels: ["spu2"], price: 109999 },
      { labels: ["spu1", "spu3"], price: 219999 },
    ]);
  });

  test("caps used differently stay apart even at the same price", () => {
    // spu1 is +0.5倍 to 1,000P and only for 39ショップ, so ¥3,300 earns it nothing.
    const only39 = { ...spu("1", 0.5, 1000), conditions: { shopTags: ["39shop" as const] } };
    const target = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      benefits: [only39, spu("3", 0.5, 1000)],
    });
    expect(labelsOf(target).map((row) => row.labels)).toEqual([["spu3"], ["spu1"]]);
  });
});
