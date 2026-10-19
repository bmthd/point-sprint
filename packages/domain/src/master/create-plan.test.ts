import * as v from "valibot";
import { expect, test } from "vitest";
import { comesWithPlan } from "../model/campaign-template";
import type { OfficialEvent } from "../model/official-event";
import { PlanSchema, type Profile } from "../model/plan";
import { campaignTemplates } from "./campaigns";
import { createPlan } from "./create-plan";
import { standardSpu } from "./spu";

const now = "2026-10-04T12:34:56.000Z";
const profile: Profile = { spuBenefits: standardSpu, updatedAt: now };
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
const planId = "0f1e2d3c-4b5a-4968-8776-655443322110";
const fixedTemplates = campaignTemplates.filter(comesWithPlan);

function idSequence() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

test("snapshots profile SPU and event benefits", () => {
  const plan = createPlan({ id: planId, name: "plan", event, profile, now, newId: idSequence() });
  expect(plan.benefits).toHaveLength(
    profile.spuBenefits.length + event.benefits.length + fixedTemplates.length,
  );
  expect(plan.officialEventId).toBe(event.id);
  expect(plan.period).toEqual(event.period);

  const before = structuredClone(profile);
  const first = plan.benefits[0];
  if (!first) throw new Error("no benefits");
  first.enabled = !first.enabled;
  first.label = "changed";
  expect(profile).toEqual(before);
});

test("plan without event uses today as period", () => {
  const plan = createPlan({ id: planId, name: "plan", profile, now, newId: idSequence() });
  expect(plan.period).toEqual({ start: "2026-10-04", end: "2026-10-04" });
  expect(plan.officialEventId).toBeUndefined();
  expect(plan.benefits).toHaveLength(profile.spuBenefits.length + fixedTemplates.length);
});

test("plan without event uses the Japan date at the UTC boundary", () => {
  const plan = createPlan({
    id: planId,
    name: "plan",
    profile,
    now: "2026-10-04T23:30:00.000Z",
    newId: idSequence(),
  });
  expect(plan.period).toEqual({ start: "2026-10-05", end: "2026-10-05" });
});

test("created plan parses", () => {
  const plan = createPlan({ id: planId, name: "plan", event, profile, now, newId: idSequence() });
  expect(v.parse(PlanSchema, plan)).toEqual(plan);
  expect(plan.orders).toEqual([]);
  expect(plan.updatedAt).toBe(now);
});

test("createPlan adds fixed campaigns disabled", () => {
  const plan = createPlan({ id: planId, name: "plan", event, profile, now, newId: idSequence() });
  const added = plan.benefits.slice(-fixedTemplates.length);
  expect(fixedTemplates.length).toBeGreaterThan(0);
  expect(added.map((b) => b.sharedKey)).toEqual(fixedTemplates.map((t) => t.benefit.sharedKey));
  expect(added.map((b) => b.enabled)).toEqual(fixedTemplates.map(() => false));
  expect(added.map((b) => b.id)).toEqual(
    fixedTemplates.map(
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ),
  );
});

test("createPlan leaves out ご愛顧感謝デー and ワンダフルデー, which the user adds", () => {
  const plan = createPlan({ id: planId, name: "plan", profile, now, newId: idSequence() });
  expect(plan.benefits.some((b) => b.sharedKey === "pointday")).toBe(true);
  expect(plan.benefits.some((b) => b.sharedKey === "thanks-day")).toBe(false);
  expect(plan.benefits.some((b) => b.sharedKey === "wonderfulday")).toBe(false);
});
