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

test("tells Kobo URLs from Books URLs on the same host", () => {
  expect(parseUrl("https://books.rakuten.co.jp/rb/12345/")?.channel).toBe("rakuten-books");
  expect(parseUrl("https://books.rakuten.co.jp/rk/0a1b2c3d4e5f3a7b8c9d0e1f2a3b4c5d/")).toEqual({
    channel: "rakuten-kobo",
  });
  expect(parseUrl("https://books.rakuten.co.jp/rkb/12345/")?.channel).toBe("rakuten-books");
});

test("returns null for unrelated or invalid URLs", () => {
  expect(parseUrl("https://example.com/")).toBeNull();
  expect(parseUrl("not a url")).toBeNull();
});

test("Kobo counts toward and receives shop-around", () => {
  expect(channels["rakuten-kobo"].countsTowardShopAround).toBe(true);
  expect(channels["rakuten-kobo"].receivesShopAround).toBe(true);
});
