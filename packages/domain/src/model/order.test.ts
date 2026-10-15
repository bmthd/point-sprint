import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { LineItemSchema, OrderSchema, withShop } from "./order";

const validItem = {
  id: "3f2b8c1e-5d4a-4e7b-9a10-1c2d3e4f5a6b",
  name: "item",
  unitPrice: 1000,
  quantity: 2,
  taxRate: 0.1,
};

describe("LineItemSchema", () => {
  test("accepts a line item with default discount", () => {
    expect(v.parse(LineItemSchema, validItem).discount).toBe(0);
  });

  test("rejects discount larger than the line amount", () => {
    expect(v.safeParse(LineItemSchema, { ...validItem, discount: 2001 }).success).toBe(false);
  });

  test("rejects unsupported tax rate", () => {
    expect(v.safeParse(LineItemSchema, { ...validItem, taxRate: 0.05 }).success).toBe(false);
  });
});

describe("OrderSchema", () => {
  const common = {
    id: "7a1c9d2e-0b3f-4c5d-8e6f-2a3b4c5d6e7f",
    date: "2026-10-04",
    lineItems: [validItem],
  };
  test("switching shops constructs only the selected purchase shape", () => {
    const shopId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    const unspecified = v.parse(OrderSchema, {
      ...common,
      channel: "rakuten-kobo",
      shopTags: ["39shop"],
    });
    const registered = withShop(unspecified, shopId, {
      channel: "rakuten-kobo",
      shopTags: ["39shop"],
    });
    expect(registered).toEqual({
      ...common,
      lineItems: [{ ...validItem, discount: 0 }],
      onHold: false,
      tags: [],
      shopId,
    });
    const cleared = withShop(registered, undefined, { channel: null, shopTags: null });
    expect(cleared).toEqual({
      ...common,
      lineItems: [{ ...validItem, discount: 0 }],
      onHold: false,
      tags: [],
      channel: "rakuten-ichiba",
      shopTags: [],
    });
    expect(v.safeParse(OrderSchema, registered).success).toBe(true);
    expect(v.safeParse(OrderSchema, cleared).success).toBe(true);
  });
  test("requires purchase information without a shop and forbids mixing both shapes", () => {
    expect(
      v.safeParse(OrderSchema, { ...common, channel: "rakuten-ichiba", shopTags: [] }).success,
    ).toBe(true);
    expect(v.safeParse(OrderSchema, common).success).toBe(false);
    expect(v.safeParse(OrderSchema, { ...common, channel: "rakuten-ichiba" }).success).toBe(false);
    expect(v.safeParse(OrderSchema, { ...common, shopTags: [] }).success).toBe(false);
    const shopId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    expect(v.safeParse(OrderSchema, { ...common, shopId, channel: "rakuten-kobo" }).success).toBe(
      false,
    );
    expect(v.safeParse(OrderSchema, { ...common, shopId, shopTags: [] }).success).toBe(false);
    expect(v.safeParse(OrderSchema, { ...common, shopId, channel: undefined }).success).toBe(false);
    expect(
      v.safeParse(OrderSchema, {
        ...common,
        shopId: undefined,
        channel: "rakuten-ichiba",
        shopTags: [],
      }).success,
    ).toBe(false);
  });
  test("order defaults onHold false and tags empty", () => {
    const order = v.parse(OrderSchema, {
      id: "7a1c9d2e-0b3f-4c5d-8e6f-2a3b4c5d6e7f",
      shopId: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      date: "2026-10-04",
      lineItems: [validItem],
    });
    expect(order.onHold).toBe(false);
    expect(order.tags).toEqual([]);
  });

  test("accepts tax-exempt items and the repeat tag", () => {
    const order = v.parse(OrderSchema, {
      id: "7a1c9d2e-0b3f-4c5d-8e6f-2a3b4c5d6e7f",
      shopId: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      date: "2026-10-04",
      lineItems: [{ ...validItem, taxRate: 0 }],
      onHold: true,
      tags: ["repeat"],
    });
    expect(order.onHold).toBe(true);
    expect(order.tags).toEqual(["repeat"]);
  });

  test("rejects an order without line items", () => {
    const order = {
      id: "7a1c9d2e-0b3f-4c5d-8e6f-2a3b4c5d6e7f",
      shopId: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      date: "2026-10-04",
      lineItems: [],
    };
    expect(v.safeParse(OrderSchema, order).success).toBe(false);
  });
});
