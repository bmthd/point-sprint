import { describe, expect, test } from "vitest";
import { standardSpu } from "../master/spu";
import type { Plan } from "../model/plan";
import { toggleBenefit, toggleBenefits } from "./benefit-ops";

const idOf = (label: string): string => {
  const found = standardSpu.find((b) => b.label === label);
  if (!found) throw new Error(label);
  return found.id;
};
const REGULAR = idOf("楽天カード特典分（SPU）");
const PREMIUM = idOf("楽天プレミアムカード（特典分）");
const MOBILE = idOf("楽天モバイル");
const NORMAL = idOf("楽天カード通常分（カード本体の還元）");

const makePlan = (): Plan => ({
  id: "f0000000-0000-4000-8000-000000000001",
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: structuredClone(standardSpu).map((b) =>
    b.id === REGULAR || b.id === MOBILE ? { ...b, enabled: true } : b,
  ),
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
});

const enabledOf = (plan: Plan, id: string) => plan.benefits.find((b) => b.id === id)?.enabled;

describe("toggleBenefit", () => {
  test("enabling premium card disables the regular card SPU", () => {
    const next = toggleBenefit(makePlan(), PREMIUM);
    expect(enabledOf(next, PREMIUM)).toBe(true);
    expect(enabledOf(next, REGULAR)).toBe(false);
    expect(enabledOf(next, MOBILE)).toBe(true);
  });

  test("disabling does not touch the group", () => {
    const both = makePlan();
    both.benefits = both.benefits.map((b) => (b.id === PREMIUM ? { ...b, enabled: true } : b));
    const next = toggleBenefit(both, MOBILE);
    expect(enabledOf(next, MOBILE)).toBe(false);
    const off = toggleBenefit(toggleBenefit(makePlan(), PREMIUM), PREMIUM);
    expect(enabledOf(off, PREMIUM)).toBe(false);
    expect(enabledOf(off, REGULAR)).toBe(false);
  });

  test("toggle does not mutate the plan", () => {
    const plan = makePlan();
    const snapshot = structuredClone(plan);
    toggleBenefit(plan, PREMIUM);
    expect(plan).toEqual(snapshot);
  });

  test("unknown benefit id throws", () => {
    expect(() => toggleBenefit(makePlan(), "missing")).toThrow(/missing/);
  });
});

describe("card bonuses require the card's normal points", () => {
  const plan = (on: string[]): Plan => ({
    ...makePlan(),
    benefits: structuredClone(standardSpu).map((b) => ({ ...b, enabled: on.includes(b.id) })),
  });
  const on = (p: Plan) => [REGULAR, PREMIUM, NORMAL].filter((id) => enabledOf(p, id));

  test("enabling the premium card enables the normal points", () => {
    expect(on(toggleBenefit(plan([]), PREMIUM))).toEqual([PREMIUM, NORMAL]);
  });

  test("disabling the premium card disables the normal points", () => {
    expect(on(toggleBenefit(plan([PREMIUM, NORMAL]), PREMIUM))).toEqual([]);
  });

  test("enabling the regular card enables the normal points", () => {
    expect(on(toggleBenefit(plan([]), REGULAR))).toEqual([REGULAR, NORMAL]);
  });

  test("disabling the regular card disables the normal points", () => {
    expect(on(toggleBenefit(plan([REGULAR, NORMAL]), REGULAR))).toEqual([]);
  });

  test("switching cards keeps the normal points on", () => {
    expect(on(toggleBenefit(plan([REGULAR, NORMAL]), PREMIUM))).toEqual([PREMIUM, NORMAL]);
  });

  test("enabling the normal points enables the regular card", () => {
    expect(on(toggleBenefit(plan([]), NORMAL))).toEqual([REGULAR, NORMAL]);
  });

  test("enabling the normal points keeps a card that is on", () => {
    expect(on(toggleBenefit(plan([PREMIUM]), NORMAL))).toEqual([PREMIUM, NORMAL]);
  });

  test("disabling the normal points disables both cards", () => {
    expect(on(toggleBenefit(plan([PREMIUM, NORMAL]), NORMAL))).toEqual([]);
    expect(on(toggleBenefit(plan([REGULAR, NORMAL]), NORMAL))).toEqual([]);
  });

  test("other benefits are not touched", () => {
    expect(enabledOf(toggleBenefit(plan([MOBILE]), PREMIUM), MOBILE)).toBe(true);
  });
});

describe("toggleBenefits", () => {
  const list = () => makePlan().benefits;
  const enabledIn = (benefits: Plan["benefits"], id: string) =>
    benefits.find((b) => b.id === id)?.enabled;

  test("applies the exclusive group rule to a bare list", () => {
    const next = toggleBenefits(list(), PREMIUM);
    expect(enabledIn(next, PREMIUM)).toBe(true);
    expect(enabledIn(next, REGULAR)).toBe(false);
    expect(enabledIn(next, MOBILE)).toBe(true);
  });

  test("does not mutate the list and throws for an unknown id", () => {
    const benefits = list();
    const snapshot = structuredClone(benefits);
    toggleBenefits(benefits, PREMIUM);
    expect(benefits).toEqual(snapshot);
    expect(() => toggleBenefits(benefits, "missing")).toThrow(/missing/);
  });
});
