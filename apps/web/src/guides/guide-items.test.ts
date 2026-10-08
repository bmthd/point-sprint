import { expect, test, vi } from "vitest";
import type { RakutenItem, SearchResult } from "../rakuten/item-search";
import { type ItemSearch, collectGuideItems } from "./guide-items";

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

const guideA = ':::items{keyword="洗剤" hits=3}\n\n:::items{genreId=100227}';
// The first list again, written in another order, and a third one.
const guideB = ':::items{hits=3 keyword="洗剤"}\n\n:::items{keyword="タオル"}';

const options = () => ({
  wait: vi.fn(async (_ms: number) => {}),
  now: () => new Date("2026-10-08T00:00:00Z"),
  warn: vi.fn(),
});

test("calls each query once, one after another, 1.1 seconds apart", async () => {
  const search = vi.fn<ItemSearch>(async () => ({ ok: true, items: [item()] }));
  const opts = options();
  const { lists, fetchedAt } = await collectGuideItems([guideA, guideB], search, opts);

  expect(search.mock.calls).toEqual([
    [{ keyword: "洗剤", hits: 3, imageFlag: 1 }],
    [{ genreId: 100227, hits: 6, imageFlag: 1 }],
    [{ keyword: "タオル", hits: 6, imageFlag: 1 }],
  ]);
  expect(opts.wait.mock.calls).toEqual([[1100], [1100]]);
  expect(Object.keys(lists)).toHaveLength(3);
  expect(fetchedAt).toBe("2026-10-08T00:00:00.000Z");
});

test("the next call waits for the one before it", async () => {
  const events: string[] = [];
  const search = vi.fn<ItemSearch>(async (params) => {
    events.push(`start ${params.keyword}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push(`end ${params.keyword}`);
    return { ok: true, items: [] };
  });
  await collectGuideItems([':::items{keyword="a"}\n:::items{keyword="b"}'], search, options());
  expect(events).toEqual(["start a", "end a", "start b", "end b"]);
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
  const { lists } = await collectGuideItems([':::items{keyword="a"}'], search, options());
  expect(Object.values(lists)).toEqual([
    [
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
    ],
  ]);
});

test("a failed call leaves only its list empty, and the others are still called", async () => {
  const failed: SearchResult = { ok: false, error: { reason: "rate-limited" } };
  const search = vi
    .fn<ItemSearch>()
    .mockResolvedValueOnce(failed)
    .mockResolvedValue({ ok: true, items: [item()] });
  const opts = options();
  const { lists } = await collectGuideItems([guideA], search, opts);
  expect(Object.keys(lists)).toEqual(['{"genreId":100227,"hits":6}']);
  expect(opts.warn).toHaveBeenCalledOnce();
});

test("without the Rakuten settings, no list has items", async () => {
  expect(await collectGuideItems([guideA], undefined, options())).toEqual({
    fetchedAt: "2026-10-08T00:00:00.000Z",
    lists: {},
  });
});
