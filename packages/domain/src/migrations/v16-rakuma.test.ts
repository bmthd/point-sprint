import * as v from "valibot";
import { expect, test } from "vitest";
import { createPlan } from "#/master/create-plan.ts";
import { isRakumaBenefit } from "#/master/rakuma.ts";
import { PlanSchema } from "#/model/plan.ts";
import { migrateRow } from "./index.ts";

const row = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "plan",
  officialEventId: "marathon-2026-10-04",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: [],
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
};

test("a plan of an official event gets the ラクマ購入 +1倍 of its days, off", () => {
  const migrated = v.parse(PlanSchema, migrateRow("plans", row, 15));
  const rakuma = migrated.benefits.filter(isRakumaBenefit);
  expect(rakuma).toHaveLength(1);
  // The same benefit as a plan made from the event now gets, but for its id.
  const made = createPlan({
    id: row.id,
    name: row.name,
    event: { id: row.officialEventId, name: "お買い物マラソン", period: row.period, benefits: [] },
    now: row.updatedAt,
    newId: () => "aaaaaaaaaa",
  }).benefits.find(isRakumaBenefit);
  expect({ ...rakuma[0], id: "aaaaaaaaaa" }).toEqual(made);
  // Every device that migrates the plan adds it with the same id.
  expect(v.parse(PlanSchema, migrateRow("plans", row, 15)).benefits).toEqual(migrated.benefits);
});

test("a plan of its own days and a plan that has one are left as they are", () => {
  const { officialEventId: _, ...own } = row;
  expect(migrateRow("plans", own, 15)).toEqual(own);
  const once = migrateRow("plans", row, 15);
  expect(migrateRow("plans", once, 15)).toEqual(once);
});
