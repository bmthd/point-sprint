import { describe, expect, test } from "vitest";
import { calculateAll } from "../calculate/calculate";
import type { Benefit } from "../model/benefit";
import type { CampaignTemplate } from "../model/campaign-template";
import type { OrderTag } from "../model/common";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { campaignTemplates } from "./campaigns";
import {
  campaignInputOf,
  editCampaign,
  hasCampaignOccurrence,
  instantiateCampaign,
  templateOfCampaign,
} from "./instantiate";

const NEW_ID = "99999999-9999-4999-8999-999999999999";
const SHOP = "a0000000-0000-4000-8000-000000000001";
const PLAN_1 = "f0000000-0000-4000-8000-000000000001";
const PLAN_2 = "f0000000-0000-4000-8000-000000000002";

function template(id: string): CampaignTemplate {
  const found = campaignTemplates.find((t) => t.id === id);
  if (!found) throw new Error(`missing template ${id}`);
  return found;
}

describe("instantiateCampaign", () => {
  test("fixed template copies the benefit with a new id", () => {
    const t = template("pointday");
    const before = structuredClone(t);
    const b = instantiateCampaign(t, { id: NEW_ID });
    expect(b).toEqual({ ...t.benefit, id: NEW_ID });
    expect(b.sharedKey).toBe("pointday");
    expect(b).not.toBe(t.benefit);
    expect(b.conditions).not.toBe(t.benefit.conditions);
    expect(t).toEqual(before);
  });

  test("user-dates template sets dates and rate", () => {
    const t = template("sports-win");
    const b = instantiateCampaign(t, { id: NEW_ID, dates: ["2026-10-05"], rate: 2 });
    expect(b.conditions?.dateRule).toEqual({ type: "dates", dates: ["2026-10-05"] });
    expect(b.kind === "rate-bonus" && b.params.rate).toBe(2);
    expect(b.sharedKey).toBe("sports-win");
    expect(t.benefit.kind === "rate-bonus" && t.benefit.params.rate).toBe(1);
    expect(t.benefit.conditions?.dateRule).toBeUndefined();
  });

  test("user-dates without dates throws", () => {
    const t = template("sports-win");
    expect(() => instantiateCampaign(t, { id: NEW_ID })).toThrow(/dates/);
    expect(() => instantiateCampaign(t, { id: NEW_ID, dates: [] })).toThrow(/dates/);
  });

  test("user-period template scopes sharedKey by period start", () => {
    const t = template("39shop");
    const b = instantiateCampaign(t, {
      id: NEW_ID,
      period: { start: "2026-10-04", end: "2026-10-11" },
    });
    expect(b.sharedKey).toBe("39shop:2026-10-04");
    expect(b.conditions?.dateRule).toEqual({
      type: "range",
      start: "2026-10-04",
      end: "2026-10-11",
    });
    expect(t.benefit.sharedKey).toBe("39shop");
  });

  test("user-period without period throws", () => {
    expect(() => instantiateCampaign(template("39shop"), { id: NEW_ID })).toThrow(/period/);
  });

  test("pointday cap is shared across two plans in the same month", () => {
    const pointday = template("pointday");
    const enabled = (id: string): Benefit => ({
      ...instantiateCampaign(pointday, { id }),
      enabled: true,
    });
    const shop: Shop = {
      id: SHOP,
      channel: "rakuten-ichiba",
      name: "shop",
      tags: [],
      updatedAt: "2026-10-04T00:00:00Z",
    };
    const plan = (id: string, benefitId: string, orderId: string, date: string): Plan => ({
      id,
      name: "plan",
      period: { start: "2026-10-01", end: "2026-10-31" },
      benefits: [enabled(benefitId)],
      orders: [
        {
          id: orderId,
          shopId: SHOP,
          date,
          // 66,000 yen incl. 10% tax = 60,000 yen excl. tax -> 600 raw points.
          lineItems: [
            {
              id: `${orderId.slice(0, 8)}-0000-4000-8000-000000000000`,
              name: "item",
              unitPrice: 66000,
              quantity: 1,
              taxRate: 0.1,
              discount: 0,
            },
          ],
          onHold: false,
          tags: [],
        },
      ],
      updatedAt: "2026-10-04T00:00:00Z",
    });
    const b1 = "b1000000-0000-4000-8000-000000000001";
    const b2 = "b2000000-0000-4000-8000-000000000002";
    const results = calculateAll(
      [
        plan(PLAN_1, b1, "01000000-0000-4000-8000-000000000001", "2026-10-05"),
        plan(PLAN_2, b2, "02000000-0000-4000-8000-000000000002", "2026-10-10"),
      ],
      [shop],
    );
    const capped = (planId: string, benefitId: string) =>
      results.get(planId)?.benefitTotals.find((t) => t.benefitId === benefitId)?.cappedPoints ?? 0;
    expect(capped(PLAN_1, b1) + capped(PLAN_2, b2)).toBe(1000);
  });
});

const REPEAT_SHOP = "a0000000-0000-4000-8000-000000000002";
const ORDER = (n: number) => `0${n}000000-0000-4000-8000-00000000000${n}`;
const ITEM = (n: number) => `1${n}000000-0000-4000-8000-00000000000${n}`;
const PERIOD = { start: "2026-10-01", end: "2026-10-31" };

const emptyPlan = (benefits: Benefit[]): Plan => ({
  id: PLAN_1,
  name: "plan",
  period: PERIOD,
  benefits,
  orders: [],
  updatedAt: "2026-10-04T00:00:00Z",
});

describe("user templates", () => {
  test("repeat template targets repeat orders over 3,980 yen", () => {
    const benefit = instantiateCampaign(template("repeat"), { id: NEW_ID, period: PERIOD });
    const order = (n: number, unitPrice: number, repeat: boolean) => ({
      id: ORDER(n),
      shopId: REPEAT_SHOP,
      date: "2026-10-05",
      lineItems: [
        { id: ITEM(n), name: "item", unitPrice, quantity: 1, taxRate: 0.1 as const, discount: 0 },
      ],
      onHold: false,
      tags: repeat ? (["repeat"] satisfies OrderTag[]) : [],
    });
    const plan: Plan = {
      ...emptyPlan([benefit]),
      orders: [order(1, 3980, true), order(2, 3979, true), order(3, 3980, false)],
    };
    const shop: Shop = {
      id: REPEAT_SHOP,
      channel: "rakuten-ichiba",
      name: "shop",
      tags: [],
      updatedAt: "2026-10-04T00:00:00Z",
    };
    const result = calculateAll([plan], [shop]).get(PLAN_1);
    // 3,980 yen incl. tax = 3,619 yen excl. tax → 36 points at +1.
    expect(result?.breakdown).toEqual([{ lineItemId: ITEM(1), source: NEW_ID, points: 36 }]);
  });

  test("manual shop-around template can be instantiated with a custom cap", () => {
    const t = template("shop-around-manual");
    expect(t.occurrence).toBe("user-period");
    const b = instantiateCampaign(t, { id: NEW_ID, period: PERIOD, cap: 5000 });
    expect(b.kind).toBe("shop-around");
    expect(b.kind === "shop-around" && b.params.tiers).toHaveLength(9);
    expect(b.params.cap).toBe(5000);
    expect(b.capScope).toBe("campaign");
    expect(b.sharedKey).toBe("shop-around:2026-10-01");
    expect(t.benefit.params.cap).toBe(7000);
  });

  test("instantiate overrides cap, minOrderAmount and label", () => {
    const t = template("39shop");
    const b = instantiateCampaign(t, {
      id: NEW_ID,
      period: PERIOD,
      cap: 1500,
      minOrderAmount: 5000,
      label: "39ショップ（10月）",
    });
    expect(b.params.cap).toBe(1500);
    expect(b.conditions.minOrderAmount).toBe(5000);
    expect(b.label).toBe("39ショップ（10月）");
    expect(t.benefit.params.cap).toBe(3000);
    expect(t.benefit.conditions.minOrderAmount).toBe(3980);
    expect(t.benefit.label).toBe("39ショップ");
  });

  test("user-dates and user-period instances are enabled", () => {
    const dates = instantiateCampaign(template("sports-win"), {
      id: NEW_ID,
      dates: ["2026-10-05"],
    });
    const period = instantiateCampaign(template("39shop"), { id: NEW_ID, period: PERIOD });
    const fixed = instantiateCampaign(template("pointday"), { id: NEW_ID });
    expect(dates.enabled).toBe(true);
    expect(period.enabled).toBe(true);
    expect(fixed.enabled).toBe(false);
  });

  test("custom template has no sharedKey and a plan-scoped cap", () => {
    const t = template("custom-rate");
    const b = instantiateCampaign(t, { id: NEW_ID, period: PERIOD, rate: 3 });
    expect(b.kind === "rate-bonus" && b.params.rate).toBe(3);
    expect(b.sharedKey).toBeUndefined();
    expect(b.capScope).toBe("plan");
    expect(b.params.cap).toBeUndefined();
  });
});

describe("hasCampaignOccurrence", () => {
  test("fixed template is present once added", () => {
    const t = template("pointday");
    expect(hasCampaignOccurrence(emptyPlan([]), t, {})).toBe(false);
    const plan = emptyPlan([instantiateCampaign(t, { id: NEW_ID })]);
    expect(hasCampaignOccurrence(plan, t, {})).toBe(true);
  });

  test("hasCampaignOccurrence detects same period", () => {
    const t = template("39shop");
    const plan = emptyPlan([instantiateCampaign(t, { id: NEW_ID, period: PERIOD })]);
    expect(hasCampaignOccurrence(plan, t, { period: PERIOD })).toBe(true);
    expect(
      hasCampaignOccurrence(plan, t, { period: { start: "2026-10-02", end: "2026-10-31" } }),
    ).toBe(false);
    expect(hasCampaignOccurrence(plan, template("repeat"), { period: PERIOD })).toBe(false);
  });

  test("hasCampaignOccurrence detects overlapping dates", () => {
    const t = template("sports-win");
    const plan = emptyPlan([
      instantiateCampaign(t, { id: NEW_ID, dates: ["2026-10-05", "2026-10-06"] }),
    ]);
    expect(hasCampaignOccurrence(plan, t, { dates: ["2026-10-06", "2026-10-07"] })).toBe(true);
    expect(hasCampaignOccurrence(plan, t, { dates: ["2026-10-07"] })).toBe(false);
  });

  test("templates without sharedKey can be added repeatedly", () => {
    const t = template("custom-rate");
    const plan = emptyPlan([instantiateCampaign(t, { id: NEW_ID, period: PERIOD })]);
    expect(hasCampaignOccurrence(plan, t, { period: PERIOD })).toBe(false);
  });
});

describe("editCampaign", () => {
  test("finds the template a campaign was made from", () => {
    const period = { start: "2026-10-04", end: "2026-10-09" };
    for (const id of ["sports-win", "39shop", "repeat", "shop-around-manual", "custom-rate"]) {
      const b = instantiateCampaign(template(id), {
        id: NEW_ID,
        dates: ["2026-10-05"],
        period,
        cap: 1000,
      });
      expect(templateOfCampaign(b)?.id).toBe(id);
    }
    expect(templateOfCampaign(instantiateCampaign(template("pointday"), { id: NEW_ID }))).toBe(
      undefined,
    );
  });

  test("a changed period moves the sharedKey with its start, and keeps the rest", () => {
    const t = template("repeat");
    const b = {
      ...instantiateCampaign(t, {
        id: NEW_ID,
        period: { start: "2026-10-04", end: "2026-10-09" },
        cap: 500,
        minOrderAmount: 5000,
      }),
      enabled: false,
    };
    const edited = editCampaign(t, b, { period: { start: "2026-10-05", end: "2026-10-09" } });
    expect(edited).toMatchObject({
      id: NEW_ID,
      enabled: false,
      sharedKey: "repeat:2026-10-05",
      conditions: { minOrderAmount: 5000, orderTags: ["repeat"] },
      params: { cap: 500 },
    });
    expect(campaignInputOf(edited).period).toEqual({ start: "2026-10-05", end: "2026-10-09" });
  });

  test("a sports-win day of both teams shows the other image, and back", () => {
    const t = template("sports-win");
    const b = instantiateCampaign(t, { id: NEW_ID, dates: ["2026-10-05"], rate: 1 });
    const both = editCampaign(t, b, { rate: 2 });
    expect(both.imagePath).toBe("/img/campaign/sports-w.webp");
    expect(editCampaign(t, both, { rate: 1 }).imagePath).toBe("/img/campaign/sports.webp");
  });
});
