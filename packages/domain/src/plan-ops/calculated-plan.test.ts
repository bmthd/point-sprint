import { expect, test } from "vitest";
import { BOOKS_SPU_ID, NORMAL_POINT_ID } from "#/master/spu.ts";
import { DEFAULT_ACCOUNT_ID } from "#/model/account.ts";
import type { Plan } from "#/model/plan.ts";
import { spuMonthId } from "#/model/spu-month.ts";
import { calculatedPlan } from "./calculated-plan.ts";

const plan: Plan = {
  id: "plan",
  name: "plan",
  accountId: "deleted",
  period: { start: "2026-11-01", end: "2026-11-30" },
  benefits: [],
  orders: [
    {
      id: "order",
      channel: "rakuten-books",
      shopTags: [],
      date: "2026-11-22",
      onHold: false,
      tags: [],
      lineItems: [
        { id: "item", name: "book", unitPrice: 3000, quantity: 1, taxRate: 0, discount: 0 },
      ],
    },
  ],
  updatedAt: "2026-11-22T00:00:00.000Z",
};
const settings = { enabled: false, accounts: [] };
const months = [
  {
    id: spuMonthId(DEFAULT_ACCOUNT_ID, "2026-11"),
    accountId: DEFAULT_ACCOUNT_ID,
    month: "2026-11",
    enabledIds: [NORMAL_POINT_ID],
    updatedAt: plan.updatedAt,
  },
];

test("uses stored SPU of the effective account for an active plan", () => {
  const result = calculatedPlan(plan, settings, months, []);
  expect(result.accountId).toBeUndefined();
  expect(result.benefits.find((benefit) => benefit.id === NORMAL_POINT_ID)?.enabled).toBe(true);
  expect(result.benefits.find((benefit) => benefit.id === BOOKS_SPU_ID)?.enabled).toBe(false);
});

test("a held plan also gets its own achieved SPU without changing saved months or plan", () => {
  const held = { ...plan, onHold: true };
  const before = structuredClone({ held, months });
  const result = calculatedPlan(held, settings, months, []);
  expect(result.benefits.find((benefit) => benefit.id === BOOKS_SPU_ID)?.conditions.months).toEqual(
    ["2026-11"],
  );
  expect(result.benefits.find((benefit) => benefit.id === BOOKS_SPU_ID)?.enabled).toBe(true);
  expect({ held, months }).toEqual(before);
});
