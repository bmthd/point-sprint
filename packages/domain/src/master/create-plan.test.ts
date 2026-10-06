import * as v from "valibot";
import { expect, test } from "vitest";
import { PlanSchema, type Profile } from "../model/plan";
import { campaignTemplates } from "./campaigns";
import { createPlan } from "./create-plan";
import { officialEvents } from "./events";
import { standardSpu } from "./spu";

const now = "2026-10-04T12:34:56.000Z";
const profile: Profile = { spuBenefits: standardSpu, updatedAt: now };
const event = officialEvents[0];
const planId = "0f1e2d3c-4b5a-4968-8776-655443322110";
const fixedTemplates = campaignTemplates.filter((t) => t.occurrence === "fixed");

function idSequence() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

test("snapshots profile SPU and event benefits", () => {
  if (!event) throw new Error("no official event");
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
