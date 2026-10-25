import { describe, expect, test } from "vitest";
import {
  BANK_CARD_ID,
  BANK_SALARY_ID,
  BOOKS_SPU_ID,
  CARD_BONUS_ID,
  CARD_NORMAL_ID,
  NORMAL_POINT_ID,
} from "../master/spu";
import { calculate } from "../calculate/calculate";
import { capLines } from "../calculate/cap-lines";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import { type SpuMonth, spuMonthId } from "../model/spu-month";
import { enableSpu, planWithSpu, spuBenefitsOf, spuIdsIn, toggleSpu } from "./spu-months";

const ACCOUNT = "acc00000-0000-4000-8000-000000000000";
const OTHER = "acc00000-0000-4000-8000-000000000001";

const month = (accountId: string, value: string, enabledIds: string[]): SpuMonth => ({
  id: spuMonthId(accountId, value),
  accountId,
  month: value,
  enabledIds,
  updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("spuIdsIn", () => {
  test("a stored month is used as it is, with 通常ポイント on", () => {
    const months = [month(ACCOUNT, "2026-10", [BOOKS_SPU_ID])];
    expect(spuIdsIn(months, ACCOUNT, "2026-10")).toEqual(new Set([NORMAL_POINT_ID, BOOKS_SPU_ID]));
  });

  test("a new month takes only the carried items of the nearest earlier month", () => {
    const months = [
      month(ACCOUNT, "2026-08", [BANK_SALARY_ID]),
      month(ACCOUNT, "2026-09", [CARD_NORMAL_ID, CARD_BONUS_ID, BOOKS_SPU_ID]),
      month(ACCOUNT, "2026-12", [BANK_CARD_ID]),
    ];
    expect(spuIdsIn(months, ACCOUNT, "2026-11")).toEqual(
      new Set([NORMAL_POINT_ID, CARD_NORMAL_ID, CARD_BONUS_ID]),
    );
  });

  test("a month with no earlier month, or only another account's, starts with only 通常ポイント", () => {
    const months = [month(OTHER, "2026-09", [CARD_NORMAL_ID]), month(ACCOUNT, "2026-12", [])];
    expect(spuIdsIn(months, ACCOUNT, "2026-10")).toEqual(new Set([NORMAL_POINT_ID]));
  });
});

describe("toggleSpu", () => {
  test("turning the card's bonus on turns its normal points on too", () => {
    expect(new Set(toggleSpu(new Set([NORMAL_POINT_ID]), CARD_BONUS_ID))).toEqual(
      new Set([NORMAL_POINT_ID, CARD_BONUS_ID, CARD_NORMAL_ID]),
    );
  });

  test("one item of an exclusive group stays on", () => {
    expect(toggleSpu(new Set([BANK_CARD_ID]), BANK_SALARY_ID)).toEqual([BANK_SALARY_ID]);
  });
});

test("enableSpu leaves items already on as they are", () => {
  expect(new Set(enableSpu(new Set([BOOKS_SPU_ID]), [BOOKS_SPU_ID, CARD_BONUS_ID]))).toEqual(
    new Set([BOOKS_SPU_ID, CARD_BONUS_ID, CARD_NORMAL_ID]),
  );
});

test("spuBenefitsOf turns on exactly the given items", () => {
  const on = spuBenefitsOf(new Set([BOOKS_SPU_ID]))
    .filter((benefit) => benefit.enabled)
    .map((benefit) => benefit.id);
  expect(on).toEqual([BOOKS_SPU_ID]);
});

describe("planWithSpu", () => {
  const plan = (over: Partial<Plan> = {}): Plan => ({
    id: "f0000000-0000-4000-8000-000000000001",
    name: "plan",
    period: { start: "2026-10-25", end: "2026-11-02" },
    benefits: [],
    orders: [],
    updatedAt: "2026-10-05T00:00:00.000Z",
    ...over,
  });
  const order = (id: string, date: string): Order => ({
    id,
    date,
    channel: "rakuten-ichiba",
    shopTags: [],
    lineItems: [{ id, name: "x", unitPrice: 11000, quantity: 1, taxRate: 0.1, discount: 0 }],
    onHold: false,
    tags: [],
  });

  test("each order gets the SPU of its own month", () => {
    const months = [
      month(ACCOUNT, "2026-10", [BOOKS_SPU_ID]),
      month(ACCOUNT, "2026-11", []),
      month(OTHER, "2026-11", [BOOKS_SPU_ID]),
    ];
    const october = "00000000-0000-4000-8000-000000000001";
    const november = "00000000-0000-4000-8000-000000000002";
    const result = calculate(
      planWithSpu(
        plan({ orders: [order(october, "2026-10-30"), order(november, "2026-11-01")] }),
        months,
      ),
      [],
    );
    const books = result.breakdown.filter((row) => row.source === BOOKS_SPU_ID);
    expect(books.map((row) => row.lineItemId)).toEqual([october]);
    expect(books[0]?.points).toBe(50);
  });

  test("an order outside the period gets the SPU of its month", () => {
    const months = [month(ACCOUNT, "2026-12", [BOOKS_SPU_ID])];
    const id = "00000000-0000-4000-8000-000000000003";
    const result = calculate(planWithSpu(plan({ orders: [order(id, "2026-12-01")] }), months), []);
    expect(result.breakdown.some((row) => row.source === BOOKS_SPU_ID)).toBe(true);
  });

  test("a plan's own SPU items are not added again", () => {
    const own = spuBenefitsOf(new Set([NORMAL_POINT_ID]));
    const ids = planWithSpu(plan({ benefits: own }), []).benefits.map((benefit) => benefit.id);
    expect(ids).toEqual(own.map((benefit) => benefit.id));
  });

  test("a month cap line is drawn only for the months the item is on", () => {
    const months = [month(ACCOUNT, "2026-10", [BOOKS_SPU_ID]), month(ACCOUNT, "2026-11", [])];
    const withSpu = planWithSpu(plan(), months);
    const lines = capLines(withSpu, calculate(withSpu, []));
    expect(
      lines.filter((line) => line.benefit.id === BOOKS_SPU_ID).map((line) => line.period),
    ).toEqual(["2026-10"]);
  });
});
