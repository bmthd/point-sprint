import { describe, expect, test } from "vitest";
import { BANK_CARD_ID, CARD_BONUS_ID, CARD_NORMAL_ID } from "#/master/spu.ts";
import { type Order, paidWithRakutenCard, withRakutenCard } from "#/model/order.ts";
import type { Plan } from "#/model/plan.ts";
import { type SpuMonth, spuMonthId } from "#/model/spu-month.ts";
import { planWithSpu } from "#/plan-ops/spu-months.ts";
import { rakutenCardLoss } from "./rakuten-card.ts";

const ACCOUNT = "acc00000-0000-4000-8000-000000000000";
const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
const ORDER_ID = "00000000-0000-4000-8000-000000000001";

const months = (enabledIds: string[]): SpuMonth[] => [
  {
    id: spuMonthId(ACCOUNT, "2026-11"),
    accountId: ACCOUNT,
    month: "2026-11",
    enabledIds,
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
];

const order: Order = {
  id: ORDER_ID,
  date: "2026-11-25",
  channel: "rakuten-ichiba",
  shopTags: [],
  lineItems: [
    { id: ORDER_ID, name: "x", unitPrice: 11000, quantity: 1, taxRate: 0.1, discount: 0 },
  ],
  onHold: false,
  tags: [],
};

const plans = (enabledIds: string[], paid: boolean): Plan[] => [
  planWithSpu(
    {
      id: PLAN_ID,
      name: "plan",
      accountId: ACCOUNT,
      period: { start: "2026-11-20", end: "2026-11-27" },
      benefits: [],
      orders: [withRakutenCard(order, paid)],
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
    months(enabledIds),
  ),
];

const loss = (enabledIds: string[], paid: boolean) =>
  rakutenCardLoss({
    plans: plans(enabledIds, paid),
    shops: [],
    planId: PLAN_ID,
    orderId: ORDER_ID,
  });

describe("rakutenCardLoss", () => {
  test("is the card's normal points, its bonus and 楽天銀行's, the same whichever way it is paid", () => {
    const enabled = [CARD_NORMAL_ID, CARD_BONUS_ID, BANK_CARD_ID];
    // 通常分 1% of ¥11,000, 特典分 1% of ¥10,000 and 楽天銀行 0.3% of ¥10,000.
    const expected = { points: 240, parts: ["normal", "bonus", "bank"] };
    expect(loss(enabled, true)).toEqual(expected);
    expect(loss(enabled, false)).toEqual(expected);
  });

  test("names only the parts that are on", () => {
    expect(loss([CARD_NORMAL_ID], false)).toEqual({ points: 110, parts: ["normal"] });
  });

  test("is nothing when the month has none of them", () => {
    expect(loss([], true)).toEqual({ points: 0, parts: [] });
  });
});

describe("withRakutenCard", () => {
  test("stores only an order paid otherwise, and reads an order without it as paid", () => {
    expect("rakutenCard" in withRakutenCard({ ...order, rakutenCard: false }, true)).toBe(false);
    expect(withRakutenCard(order, false).rakutenCard).toBe(false);
    expect(paidWithRakutenCard(order)).toBe(true);
    expect(paidWithRakutenCard(withRakutenCard(order, false))).toBe(false);
  });
});
