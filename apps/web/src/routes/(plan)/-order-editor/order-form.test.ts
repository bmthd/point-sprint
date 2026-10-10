import * as v from "valibot";
import { expect, test } from "vitest";
import { OrderSchema } from "@workspaces/domain";
import { NEW_SHOP } from "../-order-fields";
import { type ItemInput, OrderFormSchema, emptyInput, emptyItem, inputOf } from "./order-form";

const SHOP_ID = "a0000000-0000-4000-8000-000000000001";
const PERIOD = { start: "2026-10-04", end: "2026-10-09" };

const item = (fields: Partial<ItemInput>): ItemInput => ({
  ...emptyItem(),
  unitPrice: "1000",
  ...fields,
});

/** The errors of each field, by its path joined with dots. */
function errorsOf(fields: Partial<ReturnType<typeof emptyInput>>) {
  const result = v.safeParse(OrderFormSchema, {
    ...emptyInput(PERIOD),
    shop: SHOP_ID,
    items: [item({})],
    ...fields,
  });
  if (result.success) return {};
  // The first error of a field is the one it shows.
  return Object.fromEntries(
    result.issues
      .toReversed()
      .map((issue) => [issue.path?.map((key) => String(key.key)).join(".") ?? "", issue.message]),
  );
}

test("a filled-in order has no errors", () => {
  expect(errorsOf({})).toEqual({});
  expect(errorsOf({ url: "https://item.rakuten.co.jp/shop/item/" })).toEqual({});
});

test("the URL must be a web address when it is filled in", () => {
  expect(errorsOf({ url: "item.rakuten.co.jp/shop/item/" })).toEqual({
    url: "商品のURLは https:// で始まる形で入れてください",
  });
});

test("a shop must be chosen, and a new shop named", () => {
  expect(errorsOf({ shop: "" })).toEqual({ shop: "ショップを選んでください" });
  expect(errorsOf({ shop: NEW_SHOP, newShopName: " " })).toEqual({
    newShopName: "ショップの名前を入れてください",
  });
  expect(errorsOf({ shop: NEW_SHOP, newShopName: "あ".repeat(101) })).toEqual({
    newShopName: "ショップの名前は100文字以内で入れてください",
  });
  // The name of a new shop is not asked for when a registered shop is chosen.
  expect(errorsOf({ newShopName: "" })).toEqual({});
});

test("the order date must be a date", () => {
  expect(errorsOf({ date: "" })).toEqual({ date: "注文日を入れてください" });
});

test("an order has at least one item", () => {
  expect(errorsOf({ items: [] })).toEqual({ items: "商品を1つ以上入れてください" });
});

test("each item's fields are checked on the item", () => {
  expect(
    errorsOf({
      items: [
        item({}),
        item({
          unitPrice: "12a",
          name: "あ".repeat(201),
          quantity: "0",
          discount: "-1",
          shopPointRate: "0.5",
        }),
      ],
    }),
  ).toEqual({
    "items.1.unitPrice": "金額は0以上の整数で入れてください",
    "items.1.name": "商品名メモは200文字以内で入れてください",
    "items.1.quantity": "数量は1以上の整数で入れてください",
    "items.1.discount": "クーポン値引額は0以上の整数で入れてください",
    "items.1.shopPointRate": "ショップ独自倍率は1以上の数で入れてください",
  });
});

test("a coupon is at most the item's price times its quantity", () => {
  expect(
    errorsOf({ items: [item({ unitPrice: "1,000", quantity: "2", discount: "2000" })] }),
  ).toEqual({});
  expect(
    errorsOf({ items: [item({ unitPrice: "1,000", quantity: "2", discount: "2001" })] }),
  ).toEqual({ "items.0.discount": "クーポン値引額は、金額に数量を掛けた額以下で入れてください" });
});

test("numbers are normalized before they are checked", () => {
  const result = v.parse(OrderFormSchema, {
    ...emptyInput(PERIOD),
    shop: SHOP_ID,
    items: [
      item({
        unitPrice: "¥１，０００",
        quantity: "２",
        discount: "１００円",
        shopPointRate: "３倍",
      }),
    ],
  });
  expect(result.items[0]).toMatchObject({
    unitPrice: 1000,
    quantity: 2,
    discount: 100,
    shopPointRate: 3,
  });
});

test("a saved order keeps its date when opened", () => {
  const order = v.parse(OrderSchema, {
    id: "b0000000-0000-4000-8000-000000000001",
    shopId: SHOP_ID,
    date: "2026-10-01",
    lineItems: [
      {
        id: "c0000000-0000-4000-8000-000000000001",
        name: "商品",
        unitPrice: 1000,
        quantity: 1,
        taxRate: 0.1,
      },
    ],
  });

  expect(inputOf(order, []).date).toBe("2026-10-01");
});
