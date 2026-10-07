import { expect, test } from "vitest";
import { channels, parseUrl } from "./index";

test("parses an Ichiba item URL", () => {
  expect(parseUrl("https://item.rakuten.co.jp/shop-a/item-123/")).toEqual({
    channel: "rakuten-ichiba",
    shopCode: "shop-a",
    itemManageNumber: "item-123",
  });
});

test("parses an Ichiba shop URL", () => {
  expect(parseUrl("https://www.rakuten.co.jp/shop-a/")).toEqual({
    channel: "rakuten-ichiba",
    shopCode: "shop-a",
  });
});

test("parses GOLD shop URLs and rejects reserved Ichiba paths", () => {
  expect(parseUrl("https://www.rakuten.co.jp/gold/shop-a/")).toEqual({
    channel: "rakuten-ichiba",
    shopCode: "shop-a",
  });
  expect(parseUrl("https://www.rakuten.co.jp/gold/")).toBeNull();
  expect(parseUrl("https://www.rakuten.co.jp/search/mall/abc/")).toBeNull();
  expect(parseUrl("https://www.rakuten.co.jp/category/100371/")).toBeNull();
});

test("parses Books and Rakuma URLs", () => {
  expect(parseUrl("https://books.rakuten.co.jp/rb/12345/")?.channel).toBe("rakuten-books");
  expect(parseUrl("https://item.fril.jp/abc")?.channel).toBe("rakuma");
});

test("returns null for unrelated or invalid URLs", () => {
  expect(parseUrl("https://example.com/")).toBeNull();
  expect(parseUrl("not a url")).toBeNull();
});

test("Rakuma counts toward shop-around but does not receive it", () => {
  expect(channels.rakuma.countsTowardShopAround).toBe(true);
  expect(channels.rakuma.receivesShopAround).toBe(false);
});
