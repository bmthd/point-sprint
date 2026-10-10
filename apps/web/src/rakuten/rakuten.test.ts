import { expect, test, vi } from "vitest";
import { readRakutenConfig } from "./config";
import { type ItemLookup, type ItemLookupResult, cachedLookup } from "./item-lookup";
import { type ItemPage, type LookupResult, searchItemPage, searchItems } from "./item-search";
import { siteUrl } from "../site-url";

const page: ItemPage = { shopCode: "shop-a", itemManageNumber: "item-1" };

const config = { applicationId: "app-id", accessKey: "access-key", affiliateId: "aff-id" };

/** An item as the API returns it, with fields the app does not read. */
const apiItem = (fields: Record<string, unknown> = {}) => ({
  itemName: "洗濯洗剤 詰め替え",
  genreId: 210182,
  itemCode: "shop-a:10000001",
  itemPrice: 2980,
  itemUrl:
    "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop-a%2Fitem-1%2F",
  affiliateUrl:
    "https://hb.afl.rakuten.co.jp/hgc/x/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fshop-a%2Fitem-1%2F",
  taxFlag: 0,
  pointRate: 5,
  shopName: "ショップA",
  shopCode: "shop-a",
  reviewCount: 3,
  mediumImageUrls: [
    { imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/shop-a/item-1.jpg?_ex=128x128" },
    { imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/shop-a/item-1b.jpg?_ex=128x128" },
  ],
  ...fields,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchReturning = (response: Response | Error) =>
  vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response.clone();
  });

test("reads the settings, and none while they are missing or still encrypted", () => {
  expect(
    readRakutenConfig({
      RAKUTEN_APPLICATION_ID: "app-id",
      RAKUTEN_ACCESS_KEY: " access-key ",
      RAKUTEN_AFFILIATE_ID: "aff-id",
    }),
  ).toEqual(config);
  expect(
    readRakutenConfig({
      RAKUTEN_APPLICATION_ID: "app-id",
      RAKUTEN_ACCESS_KEY: "access-key",
    }),
  ).toEqual({ applicationId: "app-id", accessKey: "access-key" });
  expect(readRakutenConfig({ RAKUTEN_APPLICATION_ID: "app-id" })).toBeUndefined();
  expect(
    readRakutenConfig({
      RAKUTEN_APPLICATION_ID: "encrypted:BCx…",
      RAKUTEN_ACCESS_KEY: "key",
    }),
  ).toBeUndefined();
});

/** The request a mocked fetch was called with: ky passes a `Request`. */
const sentRequest = (fetcher: ReturnType<typeof fetchReturning>, call: number) => {
  const [input, init] = fetcher.mock.calls[call] ?? [];
  return input instanceof Request ? input : new Request(String(input), init);
};

test("sends the settings and the parameters, and the origin only when asked", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => json({ Items: [] }));
  await searchItems(config, { keyword: "洗剤", hits: 3 }, { fetch: fetcher });
  const first = sentRequest(fetcher, 0);
  const sent = new URL(first.url);
  expect(sent.origin + sent.pathname).toBe(
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701",
  );
  expect(Object.fromEntries(sent.searchParams)).toEqual({
    applicationId: "app-id",
    accessKey: "access-key",
    affiliateId: "aff-id",
    keyword: "洗剤",
    hits: "3",
  });
  expect(first.headers.get("Origin")).toBeNull();

  await searchItems(config, {}, { fetch: fetcher, origin: siteUrl });
  expect(sentRequest(fetcher, 1).headers.get("Origin")).toBe(siteUrl);
});

test("a 429 is not retried: the rate gate spaces the calls out", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => json({ error: "too_many_requests" }, 429));
  expect(await searchItemPage(config, page, { fetch: fetcher })).toEqual({
    ok: false,
    error: { reason: "rate-limited" },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("keeps only the fields the app uses", async () => {
  const result = await searchItemPage(config, page, {
    fetch: fetchReturning(json({ count: 1, Items: [{ Item: apiItem() }] })),
  });
  expect(result).toEqual({
    ok: true,
    item: {
      itemCode: "shop-a:10000001",
      name: "洗濯洗剤 詰め替え",
      taxIncludedPrice: 2980,
      shopCode: "shop-a",
      shopName: "ショップA",
      pointRate: 5,
      pageUrl: "https://item.rakuten.co.jp/shop-a/item-1/",
      itemUrl: apiItem().itemUrl,
      affiliateUrl: apiItem().affiliateUrl,
      imageUrl: "https://thumbnail.image.rakuten.co.jp/@0_mall/shop-a/item-1.jpg?_ex=128x128",
    },
  });
});

test("searches the shop by the manage number and takes the item on that page", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    json({
      Items: [
        // Its manage number has the one looked up in it, but it is another page.
        {
          Item: apiItem({
            itemCode: "shop-a:10000002",
            itemUrl: "https://item.rakuten.co.jp/shop-a/item-10/",
          }),
        },
        { Item: apiItem({ itemUrl: "https://item.rakuten.co.jp/shop-a/item-1/?rafcid=x" }) },
      ],
    }),
  );
  const result = await searchItemPage(config, page, { fetch: fetcher });
  expect(result.ok && result.item.itemCode).toBe("shop-a:10000001");
  expect(Object.fromEntries(new URL(sentRequest(fetcher, 0).url).searchParams)).toMatchObject({
    shopCode: "shop-a",
    keyword: "item-1",
  });
  // The API's own item code is not the manage number: no lookup by it.
  expect(new URL(sentRequest(fetcher, 0).url).searchParams.has("itemCode")).toBe(false);
});

test("items only on other pages are not found", async () => {
  const result = await searchItemPage(config, page, {
    fetch: fetchReturning(
      json({
        Items: [{ Item: apiItem({ itemUrl: "https://item.rakuten.co.jp/shop-b/item-1/" }) }],
      }),
    ),
  });
  expect(result).toEqual({ ok: false, error: { reason: "not-found" } });
});

test("an item without images has no image", async () => {
  const result = await searchItemPage(config, page, {
    fetch: fetchReturning(json({ Items: [{ Item: apiItem({ mediumImageUrls: [] }) }] })),
  });
  expect(result.ok && result.item.imageUrl).toBeUndefined();
});

test("a price without tax is not given as the price with tax", async () => {
  const result = await searchItemPage(config, page, {
    fetch: fetchReturning(json({ Items: [{ Item: apiItem({ taxFlag: 1 }) }] })),
  });
  expect(result.ok && result.item.taxIncludedPrice).toBeUndefined();
});

test.each<[string, Response | Error, LookupResult]>([
  ["no items", json({ count: 0, Items: [] }), { ok: false, error: { reason: "not-found" } }],
  [
    "a shop that does not exist",
    json({ error: "wrong_parameter", error_description: "shopCode is not valid" }, 400),
    { ok: false, error: { reason: "not-found" } },
  ],
  [
    "429",
    json({ error: "too_many_requests", error_description: "Rate limit is exceeded" }, 429),
    { ok: false, error: { reason: "rate-limited" } },
  ],
  [
    "403",
    json({ error: "HTTP_REFERRER_NOT_ALLOWED" }, 403),
    { ok: false, error: { reason: "http", status: 403 } },
  ],
  [
    "a network error",
    new TypeError("Failed to fetch"),
    { ok: false, error: { reason: "network" } },
  ],
  [
    "an unexpected body",
    json({ Items: [{ Item: { itemName: 1 } }] }),
    { ok: false, error: { reason: "invalid-response" } },
  ],
  [
    "a body that is not JSON",
    new Response("<html>"),
    { ok: false, error: { reason: "invalid-response" } },
  ],
])("%s fails the lookup", async (_case, response, expected) => {
  expect(await searchItemPage(config, page, { fetch: fetchReturning(response) })).toEqual(expected);
});

const pageOf = (itemManageNumber: string): ItemPage => ({ shopCode: "shop-a", itemManageNumber });

const found = ({ itemManageNumber }: ItemPage): LookupResult => ({
  ok: true,
  item: {
    itemCode: "shop-a:10000001",
    name: itemManageNumber,
    taxIncludedPrice: 1000,
    shopCode: "shop-a",
    shopName: "ショップA",
    pointRate: 1,
    pageUrl: `https://item.rakuten.co.jp/shop-a/${itemManageNumber}/`,
    itemUrl: `https://item.rakuten.co.jp/shop-a/${itemManageNumber}/`,
    affiliateUrl: "",
    imageUrl: undefined,
  },
});

test("a found item is kept for five minutes, and a failure is not kept", async () => {
  let time = 1_000_000;
  const lookup = vi
    .fn<ItemLookup>()
    .mockResolvedValueOnce({ ok: false, error: { reason: "busy", waitMs: 6000 } })
    .mockImplementation(async (asked) => found(asked));
  const cached = cachedLookup(lookup, { now: () => time });
  const options = { maxWaitMs: 5000 };

  const busy: ItemLookupResult = { ok: false, error: { reason: "busy", waitMs: 6000 } };
  expect(await cached(pageOf("1"), options)).toEqual(busy);
  expect(await cached(pageOf("1"), options)).toEqual(found(pageOf("1")));
  expect(await cached(pageOf("1"), options)).toEqual(found(pageOf("1")));
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(lookup).toHaveBeenLastCalledWith(pageOf("1"), options);

  await cached(pageOf("2"), options);
  expect(lookup).toHaveBeenCalledTimes(3);
  time += 5 * 60_000;
  await cached(pageOf("1"), options);
  expect(lookup).toHaveBeenCalledTimes(4);
});
