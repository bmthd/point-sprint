import { expect, test, vi } from "vitest";
import type { RakutenItem, SearchResult } from "../rakuten/item-search";
import { type ItemSearch, guideItemSearch } from "./guide-items";
import type { ItemQuery } from "./item-query";

const item = (fields: Partial<RakutenItem> = {}): RakutenItem => ({
  itemCode: "shop-a:10000001",
  name: "はとむぎ粉 330g",
  taxIncludedPrice: 1000,
  shopCode: "shop-a",
  shopName: "ショップA",
  pointRate: 1,
  pageUrl: "https://item.rakuten.co.jp/shop-a/item-1/",
  itemUrl:
    "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop-a%2Fitem-1%2F",
  affiliateUrl:
    "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop-a%2Fitem-1%2F",
  imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/shop-a/item-1.jpg?_ex=128x128",
  ...fields,
});

const options = () => ({ wait: vi.fn(async (_ms: number) => {}), warn: vi.fn() });

const detergent: ItemQuery = { keyword: "洗剤", hits: 3 };
const food: ItemQuery = { genreId: 100227, hits: 6 };

test("calls one after another, 1.1 seconds apart, even when asked at once", async () => {
  const events: string[] = [];
  const search = vi.fn<ItemSearch>(async (params) => {
    events.push(`start ${params.hits}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push(`end ${params.hits}`);
    return { ok: true, items: [item()] };
  });
  const opts = options();
  const searchFor = guideItemSearch(search, opts);
  await Promise.all([searchFor(detergent), searchFor(food)]);

  expect(search.mock.calls).toEqual([
    [{ keyword: "洗剤", hits: 3, imageFlag: 1 }],
    [{ genreId: 100227, hits: 6, imageFlag: 1 }],
  ]);
  expect(events).toEqual(["start 3", "end 3", "start 6", "end 6"]);
  expect(opts.wait.mock.calls).toEqual([[1100]]);
});

test("the same query is called once, for every guide that has it", async () => {
  const search = vi.fn<ItemSearch>(async () => ({ ok: true, items: [item()] }));
  const searchFor = guideItemSearch(search, options());
  const [first, again] = await Promise.all([
    searchFor(detergent),
    searchFor({ hits: 3, keyword: "洗剤" }),
  ]);
  expect(again).toBe(first);
  expect(search).toHaveBeenCalledOnce();
});

test("keeps what a list shows: the price with tax, and the affiliate link", async () => {
  const search = vi.fn<ItemSearch>(async () => ({
    ok: true,
    items: [
      item(),
      // Listed without tax: left out, since the list shows prices with tax.
      item({ itemCode: "shop-a:2", taxIncludedPrice: undefined }),
      // No affiliate id: the item page.
      item({
        itemCode: "shop-b:3",
        affiliateUrl: "",
        itemUrl: "https://item.rakuten.co.jp/shop-b/item-3/",
        imageUrl: undefined,
      }),
    ],
  }));
  expect(await guideItemSearch(search, options())(detergent)).toEqual([
    {
      itemCode: "shop-a:10000001",
      name: "はとむぎ粉 330g",
      price: 1000,
      shopName: "ショップA",
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/shop-a/item-1.jpg?_ex=256x256",
      url: item().affiliateUrl,
    },
    {
      itemCode: "shop-b:3",
      name: "はとむぎ粉 330g",
      price: 1000,
      shopName: "ショップA",
      imageUrl: undefined,
      url: "https://item.rakuten.co.jp/shop-b/item-3/",
    },
  ]);
});

test("a failed call gives no items for its query only, and the next is still called", async () => {
  const failed: SearchResult = { ok: false, error: { reason: "rate-limited" } };
  const search = vi
    .fn<ItemSearch>()
    .mockResolvedValueOnce(failed)
    .mockResolvedValue({ ok: true, items: [item()] });
  const opts = options();
  const searchFor = guideItemSearch(search, opts);
  expect(await searchFor(detergent)).toBeUndefined();
  expect(await searchFor(food)).toHaveLength(1);
  expect(opts.warn).toHaveBeenCalledOnce();
});
