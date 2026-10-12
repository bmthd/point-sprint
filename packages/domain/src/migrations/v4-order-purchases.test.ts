import { expect, test } from "vitest";
import { migrateOrderPurchases, migrateRow } from "./index";

const shopId = "00000000-0000-4000-8000-000000000001";

test("migrates optional purchase fields into exclusive shapes", () => {
  const saved = {
    orders: [
      { id: "registered", shopId, channel: "rakuma", shopTags: ["39shop"], amount: 1000 },
      {
        id: "unspecified",
        shopId: undefined,
        channel: undefined,
        shopTags: undefined,
        amount: 2000,
      },
      { id: "rakuma", channel: "rakuma", shopTags: ["39shop"], amount: 3000 },
    ],
  };
  expect(migrateRow("plans", saved, 3)).toEqual({
    orders: [
      { id: "registered", shopId, amount: 1000 },
      { id: "unspecified", channel: "rakuten-ichiba", shopTags: [], amount: 2000 },
      { id: "rakuma", channel: "rakuma", shopTags: ["39shop"], amount: 3000 },
    ],
  });
});

test("moves an unnamed shop's purchase context onto its orders", () => {
  const shops = [
    {
      id: shopId,
      name: "",
      channel: "rakuma" as const,
      tags: ["39shop" as const],
      updatedAt: "2026-10-13T00:00:00Z",
    },
  ];
  const saved = { orders: [{ id: "order", shopId, amount: 1500 }] };
  const expected = {
    orders: [{ id: "order", channel: "rakuma", shopTags: ["39shop"], amount: 1500 }],
  };
  expect(migrateOrderPurchases(saved, shops)).toEqual(expected);
  expect(migrateOrderPurchases(expected, shops)).toEqual(expected);
});
