import { expect, test, vi } from "vitest";
import { readRakutenConfig } from "./config";
import { type ItemLookup, throttledLookup } from "./item-lookup";
import { type LookupResult, lookupItem, searchItems } from "./item-search";

const config = { applicationId: "app-id", accessKey: "access-key", affiliateId: "aff-id" };

/** An item as the API returns it, with fields the app does not read. */
const apiItem = (fields: Record<string, unknown> = {}) => ({
  itemName: "洗濯洗剤 詰め替え",
  genreId: 210182,
  itemCode: "shop-a:item-1",
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
      PUBLIC_RAKUTEN_APPLICATION_ID: "app-id",
      PUBLIC_RAKUTEN_ACCESS_KEY: " access-key ",
      PUBLIC_RAKUTEN_AFFILIATE_ID: "aff-id",
    }),
  ).toEqual(config);
  expect(
    readRakutenConfig({
      PUBLIC_RAKUTEN_APPLICATION_ID: "app-id",
      PUBLIC_RAKUTEN_ACCESS_KEY: "access-key",
    }),
  ).toEqual({ applicationId: "app-id", accessKey: "access-key" });
  expect(readRakutenConfig({ PUBLIC_RAKUTEN_APPLICATION_ID: "app-id" })).toBeUndefined();
  expect(
    readRakutenConfig({
      PUBLIC_RAKUTEN_APPLICATION_ID: "encrypted:BCx…",
      PUBLIC_RAKUTEN_ACCESS_KEY: "key",
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

  await searchItems(
    config,
    {},
    {
      fetch: fetcher,
      endpoint: "http://localhost:5173/rakuten-api/ichibams/api/IchibaItem/Search/20260701",
      origin: "https://point-sprint.bmth.dev",
    },
  );
  const relayed = sentRequest(fetcher, 1);
  expect(new URL(relayed.url).pathname).toBe(
    "/rakuten-api/ichibams/api/IchibaItem/Search/20260701",
  );
  expect(relayed.headers.get("Origin")).toBe("https://point-sprint.bmth.dev");
});

test("a 429 is not retried: the caller spaces the calls out", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => json({ error: "too_many_requests" }, 429));
  expect(await lookupItem(config, "shop-a:item-1", { fetch: fetcher })).toEqual({
    ok: false,
    error: { reason: "rate-limited" },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("keeps only the fields the app uses", async () => {
  const result = await lookupItem(config, "shop-a:item-1", {
    fetch: fetchReturning(json({ count: 1, Items: [{ Item: apiItem() }] })),
  });
  expect(result).toEqual({
    ok: true,
    item: {
      itemCode: "shop-a:item-1",
      name: "洗濯洗剤 詰め替え",
      taxIncludedPrice: 2980,
      shopCode: "shop-a",
      shopName: "ショップA",
      pointRate: 5,
      itemUrl: apiItem().itemUrl,
      affiliateUrl: apiItem().affiliateUrl,
    },
  });
});

test("a price without tax is not given as the price with tax", async () => {
  const result = await lookupItem(config, "shop-a:item-1", {
    fetch: fetchReturning(json({ Items: [{ Item: apiItem({ taxFlag: 1 }) }] })),
  });
  expect(result.ok && result.item.taxIncludedPrice).toBeUndefined();
});

test.each<[string, Response | Error, LookupResult]>([
  ["no items", json({ count: 0, Items: [] }), { ok: false, error: { reason: "not-found" } }],
  [
    "a shop that does not exist",
    json({ error: "wrong_parameter", error_description: "itemCode is not valid" }, 400),
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
  expect(await lookupItem(config, "shop-a:item-1", { fetch: fetchReturning(response) })).toEqual(
    expected,
  );
});

const found = (itemCode: string): LookupResult => ({
  ok: true,
  item: {
    itemCode,
    name: itemCode,
    taxIncludedPrice: 1000,
    shopCode: "shop-a",
    shopName: "ショップA",
    pointRate: 1,
    itemUrl: "https://item.rakuten.co.jp/shop-a/x/",
    affiliateUrl: "",
  },
});

/** A clock that only moves when the lookup waits. */
function fakeClock() {
  let time = 1_000_000;
  const waits: number[] = [];
  return {
    now: () => time,
    wait: async (ms: number) => {
      waits.push(ms);
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
    waits,
  };
}

test("calls are spaced out, and the same item code is called once", async () => {
  const clock = fakeClock();
  const lookup = vi.fn<ItemLookup>(async (itemCode) => found(itemCode));
  const throttled = throttledLookup(lookup, { intervalMs: 1100, ...clock });

  const [a, b, again] = await Promise.all([
    throttled("shop-a:1"),
    throttled("shop-a:2"),
    throttled("shop-a:1"),
  ]);
  expect(a).toEqual(found("shop-a:1"));
  expect(b).toEqual(found("shop-a:2"));
  expect(again).toBe(a);
  expect(lookup.mock.calls).toEqual([["shop-a:1"], ["shop-a:2"]]);
  expect(clock.waits).toEqual([1100]);

  // Kept for a while, then asked again.
  clock.advance(60_000);
  await throttled("shop-a:1");
  expect(lookup).toHaveBeenCalledTimes(2);
  clock.advance(5 * 60_000);
  await throttled("shop-a:1");
  expect(lookup).toHaveBeenCalledTimes(3);
});

test("a failed lookup is not kept", async () => {
  const clock = fakeClock();
  const lookup = vi
    .fn<ItemLookup>()
    .mockResolvedValueOnce({ ok: false, error: { reason: "rate-limited" } })
    .mockResolvedValue(found("shop-a:1"));
  const throttled = throttledLookup(lookup, clock);

  expect(await throttled("shop-a:1")).toEqual({ ok: false, error: { reason: "rate-limited" } });
  expect(await throttled("shop-a:1")).toEqual(found("shop-a:1"));
  expect(lookup).toHaveBeenCalledTimes(2);
});
