import { describe, expect, test } from "vitest";
import { BOOKS_SPU_ID, KOBO_SPU_ID, standardSpu } from "../master/spu";
import type { ChannelId } from "../model/common";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { toggleBenefit } from "./benefit-ops";
import {
  achievedSpuPurchases,
  disabledAchievedSpu,
  enableAchievedSpu,
  lostSpuPurchases,
} from "./spu-purchases";

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
  over: { onHold?: boolean; discount?: number } = {},
): Order => {
  const id = `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  const item = { id, name: "本", unitPrice: amount, quantity: 1, taxRate: 0.1 as const };
  const base = {
    id,
    date: "2026-10-05",
    lineItems: [{ ...item, discount: over.discount ?? 0 }],
    onHold: over.onHold ?? false,
    tags: [],
  };
  return "shopId" in purchase
    ? { ...base, shopId: purchase.shopId }
    : { ...base, channel: purchase.channel, shopTags: [] };
};

const plan = (orders: Order[]): Plan => ({
  id: "f0000000-0000-4000-8000-000000000001",
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: structuredClone(standardSpu),
  orders,
  updatedAt: "2026-10-05T00:00:00.000Z",
});

const enabledOf = (target: Plan, id: string) => target.benefits.find((b) => b.id === id)?.enabled;

describe("achievedSpuPurchases", () => {
  test("one order of 3,000円 or more on Books or Kobo achieves its SPU", () => {
    expect(achievedSpuPurchases(plan([order(3000, { shopId: BOOKS_SHOP })]), shops)).toEqual(
      new Set([BOOKS_SPU_ID]),
    );
    expect(achievedSpuPurchases(plan([order(3000, { channel: "rakuten-kobo" })]), shops)).toEqual(
      new Set([KOBO_SPU_ID]),
    );
  });

  test("orders are not summed, and discounts, held orders and other channels do not count", () => {
    const orders = [
      order(2000, { channel: "rakuten-books" }),
      order(2000, { channel: "rakuten-books" }),
      order(3000, { channel: "rakuten-books" }, { onHold: true }),
      order(5000, { channel: "rakuten-ichiba" }),
    ];
    const discounted = order(3000, { channel: "rakuten-kobo" }, { discount: 1 });
    expect(achievedSpuPurchases(plan([...orders, discounted]), shops).size).toBe(0);
  });

  test("an order whose shop is not in the registry achieves nothing", () => {
    expect(achievedSpuPurchases(plan([order(3000, { shopId: BOOKS_SHOP })]), []).size).toBe(0);
  });
});

describe("enableAchievedSpu", () => {
  test("an order that achieves the SPU turns it on", () => {
    const before = plan([]);
    const after = enableAchievedSpu(before, plan([order(3000, { shopId: BOOKS_SHOP })]), shops);
    expect(enabledOf(after, BOOKS_SPU_ID)).toBe(true);
    expect(enabledOf(after, KOBO_SPU_ID)).toBe(false);
  });

  test("an SPU the user turned off stays off while it stays achieved", () => {
    const achieved = enableAchievedSpu(
      plan([]),
      plan([order(3000, { shopId: BOOKS_SHOP })]),
      shops,
    );
    const off = toggleBenefit(achieved, BOOKS_SPU_ID);
    const more = { ...off, orders: [...off.orders, order(4000, { channel: "rakuten-books" })] };
    expect(enabledOf(enableAchievedSpu(off, more, shops), BOOKS_SPU_ID)).toBe(false);
    expect(disabledAchievedSpu(more, shops)).toEqual([BOOKS_SPU_ID]);
  });

  test("a change that achieves nothing new returns the plan as it is", () => {
    const after = plan([order(1000, { channel: "rakuten-books" })]);
    expect(enableAchievedSpu(plan([]), after, shops)).toBe(after);
  });

  test("no warning while the achieved SPU is on", () => {
    const after = enableAchievedSpu(
      plan([]),
      plan([order(3000, { channel: "rakuten-kobo" })]),
      shops,
    );
    expect(disabledAchievedSpu(after, shops)).toEqual([]);
  });
});

describe("lostSpuPurchases", () => {
  const on = (orders: Order[]) => enableAchievedSpu(plan([]), plan(orders), shops);

  test("holding or deleting the only achieving order loses the SPU that is on", () => {
    const books = order(3000, { shopId: BOOKS_SHOP });
    const before = on([books]);
    const held = { ...before, orders: [{ ...books, onHold: true }] };
    expect(lostSpuPurchases(before, held, shops)).toEqual([BOOKS_SPU_ID]);
    expect(lostSpuPurchases(before, { ...before, orders: [] }, shops)).toEqual([BOOKS_SPU_ID]);
  });

  test("another achieving order keeps it, and an SPU that is off is not lost", () => {
    const first = order(3000, { channel: "rakuten-books" });
    const second = order(3500, { channel: "rakuten-books" });
    const before = on([first, second]);
    expect(lostSpuPurchases(before, { ...before, orders: [second] }, shops)).toEqual([]);
    const off = toggleBenefit(on([first]), BOOKS_SPU_ID);
    expect(lostSpuPurchases(off, { ...off, orders: [] }, shops)).toEqual([]);
  });

  test("a shop that moves to another channel loses it", () => {
    const before = on([order(3000, { shopId: BOOKS_SHOP })]);
    const moved = shops.map((shop) => ({ ...shop, channel: "rakuten-ichiba" as const }));
    expect(lostSpuPurchases(before, before, moved, shops)).toEqual([BOOKS_SPU_ID]);
  });
});
