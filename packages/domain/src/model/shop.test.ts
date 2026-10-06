import * as v from "valibot";
import { expect, test } from "vitest";
import { ShopSchema } from "./shop";

const shop = {
  id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  channel: "rakuten-ichiba",
  name: "shop",
  updatedAt: "2026-10-04T00:00:00Z",
};

test("shop tags default to empty", () => {
  expect(v.parse(ShopSchema, shop).tags).toEqual([]);
});

test("rejects unknown shop tag", () => {
  expect(v.safeParse(ShopSchema, { ...shop, tags: ["50shop"] }).success).toBe(false);
});
