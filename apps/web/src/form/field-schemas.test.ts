import * as v from "valibot";
import { describe, expect, test } from "vitest";
import {
  AmountSchema,
  DiscountSchema,
  ItemNameSchema,
  ItemUrlSchema,
  OrderDateSchema,
  QuantitySchema,
  ShopNameSchema,
  ShopRateSchema,
  dateSchema,
  optionalPointsSchema,
  pointsSchema,
  rateSchema,
  yenSchema,
} from "./field-schemas";

/** The value a schema gives for `input`, or the message of its first error. */
function parse<T>(schema: v.GenericSchema<string, T>, input: string) {
  const result = v.safeParse(schema, input);
  return result.success ? { value: result.output } : { error: result.issues[0].message };
}

describe("yen", () => {
  test("takes full-width digits, commas, spaces, ¥ and 円", () => {
    expect(parse(AmountSchema, " 11,000 ")).toEqual({ value: 11000 });
    expect(parse(AmountSchema, "１１，０００")).toEqual({ value: 11000 });
    expect(parse(AmountSchema, "¥3,980")).toEqual({ value: 3980 });
    expect(parse(AmountSchema, "￥3980")).toEqual({ value: 3980 });
    expect(parse(AmountSchema, "3980円")).toEqual({ value: 3980 });
    expect(parse(AmountSchema, "0")).toEqual({ value: 0 });
    expect(parse(AmountSchema, "99,999,999")).toEqual({ value: 99_999_999 });
  });

  test("says what to type instead", () => {
    expect(parse(AmountSchema, "")).toEqual({ error: "金額を入れてください" });
    expect(parse(AmountSchema, "  ")).toEqual({ error: "金額を入れてください" });
    expect(parse(AmountSchema, "12a")).toEqual({ error: "金額は0以上の整数で入れてください" });
    expect(parse(AmountSchema, "-1")).toEqual({ error: "金額は0以上の整数で入れてください" });
    expect(parse(AmountSchema, "1.5")).toEqual({ error: "金額は0以上の整数で入れてください" });
    expect(parse(AmountSchema, "100,000,000")).toEqual({
      error: "金額は99,999,999円以下で入れてください",
    });
  });

  test("names its field", () => {
    expect(parse(yenSchema("条件金額"), "abc")).toEqual({
      error: "条件金額は0以上の整数で入れてください",
    });
  });
});

describe("coupon", () => {
  test("is 0 when empty", () => {
    expect(parse(DiscountSchema, "")).toEqual({ value: 0 });
    expect(parse(DiscountSchema, "　")).toEqual({ value: 0 });
    expect(parse(DiscountSchema, "５００")).toEqual({ value: 500 });
  });

  test("says what to type instead", () => {
    expect(parse(DiscountSchema, "abc")).toEqual({
      error: "クーポン値引額は0以上の整数で入れてください",
    });
    expect(parse(DiscountSchema, "1000000000")).toEqual({
      error: "クーポン値引額は99,999,999円以下で入れてください",
    });
  });
});

describe("quantity", () => {
  test("takes a whole number from 1", () => {
    expect(parse(QuantitySchema, "３")).toEqual({ value: 3 });
    expect(parse(QuantitySchema, "2個")).toEqual({ value: 2 });
    expect(parse(QuantitySchema, "999")).toEqual({ value: 999 });
  });

  test("says what to type instead", () => {
    expect(parse(QuantitySchema, "")).toEqual({ error: "数量を入れてください" });
    expect(parse(QuantitySchema, "0")).toEqual({ error: "数量は1以上の整数で入れてください" });
    expect(parse(QuantitySchema, "1.5")).toEqual({ error: "数量は1以上の整数で入れてください" });
    expect(parse(QuantitySchema, "1000")).toEqual({ error: "数量は999以下で入れてください" });
  });
});

describe("shop rate", () => {
  test("is undefined when empty, and takes a number from 1", () => {
    expect(parse(ShopRateSchema, "")).toEqual({ value: undefined });
    expect(parse(ShopRateSchema, "1")).toEqual({ value: 1 });
    expect(parse(ShopRateSchema, "２．５")).toEqual({ value: 2.5 });
    expect(parse(ShopRateSchema, "10倍")).toEqual({ value: 10 });
    expect(parse(ShopRateSchema, "100")).toEqual({ value: 100 });
  });

  test("says what to type instead", () => {
    expect(parse(ShopRateSchema, "0.5")).toEqual({
      error: "ショップ独自倍率は1以上の数で入れてください",
    });
    expect(parse(ShopRateSchema, "abc")).toEqual({
      error: "ショップ独自倍率は1以上の数で入れてください",
    });
    expect(parse(ShopRateSchema, "101")).toEqual({
      error: "ショップ独自倍率は100以下で入れてください",
    });
  });
});

describe("campaign rate", () => {
  const schema = rateSchema("倍率");

  test("takes a number above 0, with + and 倍", () => {
    expect(parse(schema, "0.5")).toEqual({ value: 0.5 });
    expect(parse(schema, "+2")).toEqual({ value: 2 });
    expect(parse(schema, "＋３倍")).toEqual({ value: 3 });
  });

  test("says what to type instead", () => {
    expect(parse(schema, "")).toEqual({ error: "倍率を入れてください" });
    expect(parse(schema, "0")).toEqual({ error: "倍率は0より大きい数で入れてください" });
    expect(parse(schema, "-1")).toEqual({ error: "倍率は0より大きい数で入れてください" });
    expect(parse(schema, "100.5")).toEqual({ error: "倍率は100以下で入れてください" });
  });
});

describe("points", () => {
  test("takes full-width digits, commas and P", () => {
    expect(parse(pointsSchema("獲得上限"), "7,000P")).toEqual({ value: 7000 });
    expect(parse(pointsSchema("獲得上限"), "７０００ポイント")).toEqual({ value: 7000 });
    expect(parse(optionalPointsSchema("獲得上限"), "")).toEqual({ value: undefined });
  });

  test("says what to type instead", () => {
    expect(parse(pointsSchema("獲得上限"), "")).toEqual({ error: "獲得上限を入れてください" });
    expect(parse(optionalPointsSchema("獲得上限"), "1.5")).toEqual({
      error: "獲得上限は0以上の整数で入れてください",
    });
    expect(parse(pointsSchema("獲得上限"), "100000000")).toEqual({
      error: "獲得上限は99,999,999ポイント以下で入れてください",
    });
  });
});

describe("date", () => {
  test("takes YYYY-MM-DD", () => {
    expect(parse(OrderDateSchema, "2026-10-05")).toEqual({ value: "2026-10-05" });
    expect(parse(OrderDateSchema, "２０２６-１０-０５")).toEqual({ value: "2026-10-05" });
  });

  test("says what to type instead", () => {
    expect(parse(OrderDateSchema, "")).toEqual({ error: "注文日を入れてください" });
    expect(parse(dateSchema("開始日"), "2026/10/05")).toEqual({
      error: "開始日は YYYY-MM-DD の形で入れてください",
    });
    expect(parse(dateSchema("終了日"), "2026-13-01")).toEqual({
      error: "終了日は YYYY-MM-DD の形で入れてください",
    });
  });
});

describe("URL", () => {
  test("is undefined when empty, and takes a web address", () => {
    expect(parse(ItemUrlSchema, " ")).toEqual({ value: undefined });
    expect(parse(ItemUrlSchema, " https://item.rakuten.co.jp/shop/item/ ")).toEqual({
      value: "https://item.rakuten.co.jp/shop/item/",
    });
  });

  test("says what to type instead", () => {
    const error = "商品のURLは https:// で始まる形で入れてください";
    expect(parse(ItemUrlSchema, "item.rakuten.co.jp/shop/item/")).toEqual({ error });
    expect(parse(ItemUrlSchema, "ftp://example.com/")).toEqual({ error });
    expect(parse(ItemUrlSchema, "https://")).toEqual({ error });
  });
});

describe("text", () => {
  test("trims what is typed", () => {
    expect(parse(ShopNameSchema, " 近所の店 ")).toEqual({ value: "近所の店" });
    expect(parse(ItemNameSchema, "")).toEqual({ value: "" });
  });

  test("says what to type instead", () => {
    expect(parse(ShopNameSchema, "  ")).toEqual({ error: "ショップの名前を入れてください" });
    expect(parse(ShopNameSchema, "あ".repeat(101))).toEqual({
      error: "ショップの名前は100文字以内で入れてください",
    });
    expect(parse(ItemNameSchema, "あ".repeat(201))).toEqual({
      error: "商品名メモは200文字以内で入れてください",
    });
  });
});
