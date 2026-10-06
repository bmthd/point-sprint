import ky, { SchemaValidationError, isHTTPError } from "ky";
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

function failureOf(error: unknown): SearchFailure {
  if (isHTTPError(error)) {
    const { status } = error.response;
    return status === 429 ? { reason: "rate-limited" } : { reason: "http", status };
  }
  // A body that is not JSON, or not the shape we read.
  if (error instanceof SchemaValidationError || error instanceof SyntaxError) {
    return { reason: "invalid-response" };
  }
  return { reason: "network" };
}

/** Searches items by the API's own parameters (`keyword`, `itemCode`, `genreId`, `hits`, …). */
export async function searchItems(
  config: RakutenConfig,
  params: Record<string, string | number>,
  { endpoint = ITEM_SEARCH_ENDPOINT, fetch, origin, signal }: SearchOptions = {},
): Promise<SearchResult> {
  try {
    const body = await ky(endpoint, {
      searchParams: {
        applicationId: config.applicationId,
        accessKey: config.accessKey,
        ...(config.affiliateId ? { affiliateId: config.affiliateId } : {}),
        ...params,
      },
      // The calls are spaced out by the caller (`throttledLookup`); a retry would break that.
      retry: 0,
      ...(origin ? { headers: { Origin: origin } } : {}),
      ...(fetch ? { fetch } : {}),
      ...(signal ? { signal } : {}),
    }).json(ResponseSchema);
    return { ok: true, items: body.Items.map(({ Item }) => toItem(Item)) };
  } catch (error) {
    return { ok: false, error: failureOf(error) };
  }
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
