import type { Shop } from "@workspaces/domain";
import { expect, test } from "vitest";
import { NEW_SHOP, type ShopChoice, shopToSave } from "./order-fields";

const shop = (fields: Partial<Shop> & Pick<Shop, "id" | "name">): Shop => ({
  channel: "rakuten-ichiba",
  tags: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
  ...fields,
});

const registry = [
  shop({ id: "a0000000-0000-4000-8000-000000000001", name: "aaa-shop", shopCode: "aaa-shop" }),
  shop({ id: "a0000000-0000-4000-8000-000000000002", name: "近所の店" }),
];

const choice = (fields: Partial<ShopChoice>): ShopChoice => ({
  shop: NEW_SHOP,
  newShopName: "",
  channel: "rakuten-ichiba",
  shopCode: "",
  is39: false,
  ...fields,
});

test("a shop from a URL is reused only for the same channel and shop code", () => {
  // The name matches a registry shop, but the shop code does not: a new shop.
  const other = shopToSave(choice({ newShopName: "aaa-shop", shopCode: "bbb-shop" }), registry);
  expect(registry.map((s) => s.id)).not.toContain(other.shopId);
  expect(other.shop).toMatchObject({ name: "aaa-shop", shopCode: "bbb-shop" });

  // A registry shop without a shop code is not reused by its name for a URL either.
  const named = shopToSave(choice({ newShopName: "近所の店", shopCode: "near-shop" }), registry);
  expect(registry.map((s) => s.id)).not.toContain(named.shopId);

  const same = shopToSave(choice({ newShopName: "別の名前", shopCode: "aaa-shop" }), registry);
  expect(same.shopId).toBe(registry[0]?.id);
});

test("a typed name reuses the shop of that name on the same channel", () => {
  const typed = shopToSave(choice({ newShopName: "近所の店" }), registry);
  expect(typed.shopId).toBe(registry[1]?.id);

  const elsewhere = shopToSave(
    choice({ newShopName: "近所の店", channel: "rakuten-books" }),
    registry,
  );
  expect(registry.map((s) => s.id)).not.toContain(elsewhere.shopId);
});
