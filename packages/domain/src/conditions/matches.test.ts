import { expect, test } from "vitest";
import type { Conditions } from "../model/common";
import { matchesConditions, type ConditionContext } from "./matches";

const ctx: ConditionContext = {
  channel: "rakuten-ichiba",
  shopId: "shop-1",
  date: "2026-10-05",
  orderTaxIncluded: 5000,
  shopTags: [],
  orderTags: [],
};

test("days ending in 0 or 5", () => {
  const conditions: Conditions = {
    dateRule: { type: "daysOfMonth", days: [5, 10, 15, 20, 25, 30] },
  };
  expect(matchesConditions(conditions, ctx)).toBe(true);
  expect(matchesConditions(conditions, { ...ctx, date: "2026-10-06" })).toBe(false);
});

test("channel filter", () => {
  expect(matchesConditions({ channels: ["rakuten-ichiba"] }, { ...ctx, channel: "rakuma" })).toBe(
    false,
  );
});

test("minimum order amount boundary", () => {
  const conditions = { minOrderAmount: 3980 };
  expect(matchesConditions(conditions, { ...ctx, orderTaxIncluded: 3979 })).toBe(false);
  expect(matchesConditions(conditions, { ...ctx, orderTaxIncluded: 3980 })).toBe(true);
});

test("empty conditions always match", () => {
  expect(matchesConditions({}, ctx)).toBe(true);
});

test("unknown channel fails a channel filter but passes without one", () => {
  expect(matchesConditions({ channels: ["rakuten-ichiba"] }, { ...ctx, channel: null })).toBe(
    false,
  );
  expect(matchesConditions({}, { ...ctx, channel: null })).toBe(true);
});

test("dates rule matches listed dates only", () => {
  const conditions: Conditions = { dateRule: { type: "dates", dates: ["2026-10-04"] } };
  expect(matchesConditions(conditions, { ...ctx, date: "2026-10-04" })).toBe(true);
  expect(matchesConditions(conditions, { ...ctx, date: "2026-10-05" })).toBe(false);
});

test("shopTags requires every tag", () => {
  const conditions: Conditions = { shopTags: ["39shop"] };
  expect(matchesConditions(conditions, { ...ctx, shopTags: ["39shop"] })).toBe(true);
  expect(matchesConditions(conditions, { ...ctx, shopTags: [] })).toBe(false);
});

test("shopTags fails for unknown shop", () => {
  expect(matchesConditions({ shopTags: ["39shop"] }, { ...ctx, shopTags: null })).toBe(false);
});

test("orderTags requires every tag", () => {
  const conditions: Conditions = { orderTags: ["repeat"] };
  expect(matchesConditions(conditions, { ...ctx, orderTags: ["repeat"] })).toBe(true);
  expect(matchesConditions(conditions, { ...ctx, orderTags: [] })).toBe(false);
});
