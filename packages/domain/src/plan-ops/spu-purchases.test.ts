import { describe, expect, test } from "vitest";
import { BOOKS_SPU_ID, KOBO_SPU_ID } from "../master/spu";
import { DEFAULT_ACCOUNT_ID } from "../model/account";
import type { ChannelId } from "../model/common";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { type SpuMonth, spuMonthId } from "../model/spu-month";
import {
  disabledAchievedSpu,
  lostSpuPurchases,
  newlyAchievedSpu,
  spuAchievements,
} from "./spu-purchases";

const OTHER_ACCOUNT = "acc00000-0000-4000-8000-000000000001";
const BOOKS_SHOP = "b0000000-0000-4000-8000-000000000001";
const shops: Shop[] = [
  {
    id: BOOKS_SHOP,
    channel: "rakuten-books",
    name: "楽天ブックス",
    tags: [],
    updatedAt: "2026-10-04T00:00:00Z",
  },
];

let next = 0;
const order = (
  amount: number,
  purchase: { shopId: string } | { channel: ChannelId },
  over: { onHold?: boolean; discount?: number; date?: string } = {},
): Order => {
  const id = `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const item = { id, name: "本", unitPrice: amount, quantity: 1, taxRate: 0.1 as const };
  const base = {
    id,
    date: over.date ?? "2026-10-05",
    lineItems: [{ ...item, discount: over.discount ?? 0 }],
    onHold: over.onHold ?? false,
    tags: [],
  };
  return "shopId" in purchase
    ? { ...base, shopId: purchase.shopId }
    : { ...base, channel: purchase.channel, shopTags: [] };
};

let nextPlan = 0;
const plan = (orders: Order[], accountId?: string): Plan => ({
  id: `f0000000-0000-4000-8000-${String(++nextPlan).padStart(12, "0")}`,
  name: "plan",
  ...(accountId ? { accountId } : {}),
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders,
  updatedAt: "2026-10-05T00:00:00.000Z",
});

const october = (enabledIds: string[]): SpuMonth => ({
  id: spuMonthId(DEFAULT_ACCOUNT_ID, "2026-10"),
  accountId: DEFAULT_ACCOUNT_ID,
  month: "2026-10",
  enabledIds,
  updatedAt: "2026-10-01T00:00:00.000Z",
});

const books = (month = "2026-10", accountId = DEFAULT_ACCOUNT_ID) => ({
  accountId,
  month,
  benefitId: BOOKS_SPU_ID,
});

describe("spuAchievements", () => {
  test("one order of 3,000円 or more on Books or Kobo achieves its SPU for the order's month", () => {
    expect(spuAchievements([plan([order(3000, { shopId: BOOKS_SHOP })])], shops)).toEqual([
      books(),
    ]);
    expect(
      spuAchievements(
        [plan([order(3000, { channel: "rakuten-kobo" }, { date: "2026-11-01" })])],
        shops,
      ),
    ).toEqual([{ accountId: DEFAULT_ACCOUNT_ID, month: "2026-11", benefitId: KOBO_SPU_ID }]);
  });

  test("orders are not summed, and discounts, held orders and other channels do not count", () => {
    const orders = [
      order(2000, { channel: "rakuten-books" }),
      order(2000, { channel: "rakuten-books" }),
      order(3000, { channel: "rakuten-books" }, { onHold: true }),
      order(5000, { channel: "rakuten-ichiba" }),
    ];
    const discounted = order(3000, { channel: "rakuten-kobo" }, { discount: 1 });
    expect(spuAchievements([plan([...orders, discounted])], shops)).toEqual([]);
  });

  test("an order whose shop is not in the registry achieves nothing", () => {
    expect(spuAchievements([plan([order(3000, { shopId: BOOKS_SHOP })])], [])).toEqual([]);
  });

  test("orders of several plans of one account and month achieve it once, per account", () => {
    const plans = [
      plan([order(3000, { channel: "rakuten-books" })]),
      plan([order(3000, { channel: "rakuten-books" })]),
      plan([order(3000, { channel: "rakuten-books" })], OTHER_ACCOUNT),
    ];
    expect(spuAchievements(plans, shops)).toEqual([books(), books("2026-10", OTHER_ACCOUNT)]);
  });
});

describe("newlyAchievedSpu", () => {
  test("an order in another plan of the month achieves it for every plan of the month", () => {
    const other = plan([]);
    const after = { ...other, orders: [order(3000, { shopId: BOOKS_SHOP })] };
    expect(newlyAchievedSpu([plan([]), other], [plan([]), after], shops)).toEqual([books()]);
  });

  test("one already achieved by another plan is not new", () => {
    const achieving = plan([order(3000, { channel: "rakuten-books" })]);
    const other = plan([]);
    const after = { ...other, orders: [order(4000, { channel: "rakuten-books" })] };
    expect(newlyAchievedSpu([achieving, other], [achieving, after], shops)).toEqual([]);
  });
});

describe("lostSpuPurchases", () => {
  test("holding or deleting the only achieving order loses the SPU that is on", () => {
    const achieving = order(3000, { shopId: BOOKS_SHOP });
    const before = plan([achieving]);
    const held = { ...before, orders: [{ ...achieving, onHold: true }] };
    const months = [october([BOOKS_SPU_ID])];
    expect(lostSpuPurchases({ before: [before], after: [held], shops, months })).toEqual([books()]);
  });

  test("an achieving order in another plan keeps it, and an SPU that is off is not lost", () => {
    const before = plan([order(3000, { channel: "rakuten-books" })]);
    const other = plan([order(3500, { channel: "rakuten-books" })]);
    const emptied = { ...before, orders: [] };
    const on = [october([BOOKS_SPU_ID])];
    expect(
      lostSpuPurchases({ before: [before, other], after: [emptied, other], shops, months: on }),
    ).toEqual([]);
    expect(
      lostSpuPurchases({ before: [before], after: [emptied], shops, months: [october([])] }),
    ).toEqual([]);
  });

  test("a shop that moves to another channel loses it", () => {
    const before = plan([order(3000, { shopId: BOOKS_SHOP })]);
    const moved = shops.map((shop) => ({ ...shop, channel: "rakuten-ichiba" as const }));
    const months = [october([BOOKS_SPU_ID])];
    expect(
      lostSpuPurchases({
        before: [before],
        after: [before],
        shops: moved,
        beforeShops: shops,
        months,
      }),
    ).toEqual([books()]);
  });
});

test("disabledAchievedSpu: achieved by the plan's orders but off in the month", () => {
  const achieving = plan([order(3000, { channel: "rakuten-books" })]);
  expect(disabledAchievedSpu(achieving, shops, [october([])])).toEqual([books()]);
  expect(disabledAchievedSpu(achieving, shops, [october([BOOKS_SPU_ID])])).toEqual([]);
});
