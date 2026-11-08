import * as v from "valibot";
import { expect, test } from "vitest";
import { calculate } from "#/calculate/calculate.ts";
import { createPlan } from "#/master/create-plan.ts";
import type { Benefit } from "#/model/benefit.ts";
import type { OfficialEvent } from "#/model/official-event.ts";
import type { Order } from "#/model/order.ts";
import { type Plan, PlanSchema } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import { attachToEvent } from "./attach-event.ts";

const SHOP_A = "a0000000-0000-4000-8000-000000000001";
const SHOP_B = "b0000000-0000-4000-8000-000000000002";
const now = "2026-10-01T00:00:00.000Z";

const event: OfficialEvent = {
  id: "marathon-2026-10-04",
  name: "お買い物マラソン第一弾",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: [
    {
      id: "b31ed383-3fb7-425f-9391-70ecc965aa0e",
      kind: "shop-around",
      category: "campaign",
      label: "ショップ買いまわり",
      enabled: true,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "marathon-2026-10-04",
      conditions: { dateRule: { type: "range", start: "2026-10-04", end: "2026-10-09" } },
      params: { tiers: [{ minShops: 2, rate: 1 }], cap: 7000, roundingUnit: "item" },
    },
  ],
};

const handMade: Benefit = {
  id: "c0000000-0000-4000-8000-000000000001",
  kind: "shop-around",
  category: "campaign",
  label: "買いまわり（手動）",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "campaign",
  conditions: { dateRule: { type: "range", start: "2026-10-01", end: "2026-10-20" } },
  params: { tiers: [{ minShops: 2, rate: 1 }], cap: 5000, roundingUnit: "item" },
};

const order = (id: string, shopId: string, date: string): Order => ({
  id,
  shopId,
  date,
  lineItems: [
    {
      id: `${id.slice(0, 8)}-0000-4000-8000-0000000000ff`,
      name: "item",
      unitPrice: 1100,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
});
const INSIDE = order("01000000-0000-4000-8000-000000000001", SHOP_A, "2026-10-05");
const OUTSIDE = order("02000000-0000-4000-8000-000000000002", SHOP_B, "2026-10-15");

const shops: Shop[] = [SHOP_A, SHOP_B].map((id) => ({
  id,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: now,
}));

function idSequence(prefix: string) {
  let next = 0;
  return () => `${prefix}0000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

/** A plan made without an event, then edited by hand: its period, a fixed campaign entered, a campaign added. */
function ownPlan(): Plan {
  const plan = createPlan({
    id: "f0000000-0000-4000-8000-000000000001",
    name: "自分の計画",
    now,
    newId: idSequence("e"),
  });
  const [firstFixed, ...restFixed] = plan.benefits;
  if (!firstFixed) throw new Error("no fixed campaigns");
  return {
    ...plan,
    period: { start: "2026-10-01", end: "2026-10-20" },
    benefits: [{ ...firstFixed, enabled: true }, ...restFixed, handMade],
    orders: [INSIDE, OUTSIDE],
  };
}

test("an attached plan has the period, benefits and event of a plan made from the event", () => {
  const own = ownPlan();
  const attached = attachToEvent(own, event, idSequence("d"));
  const made = createPlan({ id: own.id, name: own.name, event, now, newId: idSequence("e") });

  expect(attached.officialEventId).toBe(event.id);
  expect(attached.period).toEqual(event.period);
  const shape = (benefits: Benefit[]) => benefits.map((benefit) => ({ ...benefit, enabled: true }));
  expect(shape(attached.benefits)).toEqual(shape(made.benefits));
  expect(attached.benefits.some((benefit) => benefit.id === handMade.id)).toBe(false);
  expect(v.parse(PlanSchema, attached)).toEqual(attached);
});

test("the fixed campaigns keep their ids and whether the user entered them", () => {
  const own = ownPlan();
  const fixed = own.benefits.filter((benefit) => benefit.id !== handMade.id);
  const attached = attachToEvent(own, event, idSequence("d"));
  expect(attached.benefits.slice(event.benefits.length)).toEqual(fixed);
  expect(attached.benefits[event.benefits.length]?.enabled).toBe(true);
});

test("a fixed campaign the plan lacks is added disabled, as createPlan adds it", () => {
  const own = ownPlan();
  const [, ...rest] = own.benefits;
  const attached = attachToEvent({ ...own, benefits: rest }, event, idSequence("d"));
  const added = attached.benefits[event.benefits.length];
  expect(added?.id).toBe("d0000000-0000-4000-8000-000000000001");
  expect(added?.enabled).toBe(false);
  expect(added?.sharedKey).toBe(own.benefits[0]?.sharedKey);
});

test("the orders stay, and one outside the new period is treated as outside it", () => {
  const own = ownPlan();
  const attached = attachToEvent(own, event, idSequence("d"));
  expect(attached.orders).toEqual(own.orders);

  const result = calculate(attached, shops);
  expect(result.warnings).toContainEqual({ type: "order-outside-period", orderId: OUTSIDE.id });
  expect(result.shopCount).toBe(1);
});

test("the plan and the event are not changed", () => {
  const own = ownPlan();
  const before = structuredClone({ own, event });
  const attached = attachToEvent(own, event, idSequence("d"));
  const first = attached.benefits[0];
  if (!first) throw new Error("no benefits");
  first.label = "changed";
  expect({ own, event }).toEqual(before);
});
