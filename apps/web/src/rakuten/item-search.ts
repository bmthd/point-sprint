import * as v from "valibot";
import { ITEM_SEARCH_ENDPOINT, type RakutenConfig } from "./config";

// Calls to the Ichiba item search API. Only the fields the app uses are read from a response.

const ItemSchema = v.object({
  itemCode: v.string(),
  itemName: v.string(),
  itemPrice: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** 0: the price includes tax. 1: it does not. */
  taxFlag: v.picklist([0, 1]),
  itemUrl: v.pipe(v.string(), v.url()),
  affiliateUrl: v.optional(v.string(), ""),
  shopCode: v.string(),
  shopName: v.string(),
  pointRate: v.pipe(v.number(), v.minValue(1)),
});

const ResponseSchema = v.object({
  Items: v.array(v.object({ Item: ItemSchema })),
});

export type RakutenItem = {
  itemCode: string;
  name: string;
  /** The price with tax, or `undefined` when the shop lists it without tax. */
  taxIncludedPrice: number | undefined;
  shopCode: string;
  shopName: string;
  /** The shop's own point rate (1 for none, 10 for 「ポイント10倍」). */
  pointRate: number;
  /** The item page; an affiliate link when the config has an affiliate id. */
  itemUrl: string;
  /** The affiliate link, or `""` without an affiliate id. */
  affiliateUrl: string;
};

/** Why a call gave no items. Each is told apart so the caller can decide what to retry. */
export type SearchFailure =
  | { reason: "network" }
  | { reason: "rate-limited" }
  | { reason: "http"; status: number }
  | { reason: "invalid-response" };

export type SearchResult = { ok: true; items: RakutenItem[] } | { ok: false; error: SearchFailure };

export type SearchOptions = {
  /** `ITEM_SEARCH_ENDPOINT`, or the dev server's relay to it. */
  endpoint?: string;
  fetch?: typeof fetch;
  /**
   * The `Origin` to send, for calls from the server. A browser sends its own and does not let a
   * page change it.
   */
  origin?: string;
  signal?: AbortSignal;
};

const toItem = (item: v.InferOutput<typeof ItemSchema>): RakutenItem => ({
  itemCode: item.itemCode,
  name: item.itemName,
  taxIncludedPrice: item.taxFlag === 0 ? item.itemPrice : undefined,
  shopCode: item.shopCode,
  shopName: item.shopName,
  pointRate: item.pointRate,
  itemUrl: item.itemUrl,
  affiliateUrl: item.affiliateUrl,
});

/** Searches items by the API's own parameters (`keyword`, `itemCode`, `genreId`, `hits`, …). */
export async function searchItems(
  config: RakutenConfig,
  params: Record<string, string | number>,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const { endpoint = ITEM_SEARCH_ENDPOINT, fetch: fetcher = fetch, origin, signal } = options;
  const query = new URLSearchParams({
    applicationId: config.applicationId,
    accessKey: config.accessKey,
    ...(config.affiliateId ? { affiliateId: config.affiliateId } : {}),
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  });

  let response: Response;
  try {
    response = await fetcher(`${endpoint}?${query}`, {
      ...(origin ? { headers: { Origin: origin } } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, error: { reason: "network" } };
  }
  if (response.status === 429) return { ok: false, error: { reason: "rate-limited" } };
  if (!response.ok) return { ok: false, error: { reason: "http", status: response.status } };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: { reason: "invalid-response" } };
  }
  const parsed = v.safeParse(ResponseSchema, body);
  if (!parsed.success) return { ok: false, error: { reason: "invalid-response" } };
  return { ok: true, items: parsed.output.Items.map(({ Item }) => toItem(Item)) };
}

export type LookupFailure = SearchFailure | { reason: "not-found" };
export type LookupResult = { ok: true; item: RakutenItem } | { ok: false; error: LookupFailure };

/** The item of an item code (`<shop code>:<item manage number>`). */
export async function lookupItem(
  config: RakutenConfig,
  itemCode: string,
  options: SearchOptions = {},
): Promise<LookupResult> {
  const result = await searchItems(config, { itemCode, hits: 1 }, options);
  // An item code of a shop that does not exist is answered with 400 `itemCode is not valid`.
  if (!result.ok && result.error.reason === "http" && result.error.status === 400) {
    return { ok: false, error: { reason: "not-found" } };
  }
  if (!result.ok) return result;
  const [item] = result.items;
  return item ? { ok: true, item } : { ok: false, error: { reason: "not-found" } };
}
