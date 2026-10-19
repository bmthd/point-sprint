import type { RakutenItem, SearchResult } from "../rakuten/item-search";
import { type ItemQuery, itemQueryKey } from "./item-query";

// The items of the guides' `:::items{…}` lists, searched by the server function while the build
// prerenders the guides.

/** An item as a list shows it. */
export type GuideItem = {
  itemCode: string;
  name: string;
  /** With tax. */
  price: number;
  shopName: string;
  imageUrl: string | undefined;
  /** The affiliate link, or the item page when the build had no affiliate id. */
  url: string;
};

/** A call to the item search API, with the build's settings. */
export type ItemSearch = (params: Record<string, string | number>) => Promise<SearchResult>;

/** The items of a query. It rejects when they could not be searched. */
export type GuideItemSearch = (query: ItemQuery) => Promise<GuideItem[]>;

/** The API's 128px image, asked at a size that stays sharp in a list on a high density screen. */
const largerImage = (url: string) => url.replace(/([?&]_ex=)128x128\b/, "$1256x256");

const toGuideItem = (item: RakutenItem, price: number): GuideItem => ({
  itemCode: item.itemCode,
  name: item.name,
  price,
  shopName: item.shopName,
  imageUrl: item.imageUrl && largerImage(item.imageUrl),
  url: item.affiliateUrl || item.itemUrl,
});

/** A list shows the price with tax: an item a shop lists without tax is left out. */
const shownItems = (items: RakutenItem[]) =>
  items.flatMap((item) =>
    item.taxIncludedPrice === undefined ? [] : [toGuideItem(item, item.taxIncludedPrice)],
  );

type Options = {
  /** The least time between two calls: the API answers 429 above about one call a second. */
  intervalMs?: number;
  /**
   * The waits before calling a query again while the API answers 429, one call after each. Other
   * builds may be calling with the same application id at the same time, so the interval alone
   * does not keep the calls under the limit.
   */
  retryWaitsMs?: number[];
  wait?: (ms: number) => Promise<void>;
  warn?: (message: string) => void;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `search` for the guides' lists. The build prerenders the guides side by side, so the calls of
 * every guide are queued one after another, `intervalMs` apart, and a query is called once. A call
 * the API answers 429 is called again after each of `retryWaitsMs`. A query whose call still
 * fails rejects, failing the build rather than publishing the guide without the list.
 */
export function guideItemSearch(
  search: ItemSearch,
  {
    intervalMs = 1100,
    retryWaitsMs = [2000, 4000, 8000],
    wait = sleep,
    warn = console.warn,
  }: Options = {},
): GuideItemSearch {
  const found = new Map<string, Promise<GuideItem[]>>();
  let queue: Promise<unknown> = Promise.resolve();
  let called = false;

  const call = async (query: ItemQuery) => {
    if (called) await wait(intervalMs);
    called = true;
    const key = itemQueryKey(query);
    const params = Object.entries(query).filter(([, value]) => value !== undefined);
    // Only items with an image: a list without pictures does not help choose.
    const searchQuery = () => search({ ...Object.fromEntries(params), imageFlag: 1 });
    let result = await searchQuery();
    for (const retryWait of retryWaitsMs) {
      if (result.ok || result.error.reason !== "rate-limited") break;
      warn(`The items for ${key} were rate-limited: searching again in ${retryWait}ms.`);
      await wait(retryWait);
      result = await searchQuery();
    }
    if (result.ok) return shownItems(result.items);
    const message = `The items for ${key} were not found (${JSON.stringify(result.error)}).`;
    // The prerendering reports only that the page failed: this says why.
    warn(message);
    throw new Error(message);
  };

  return (query) => {
    const key = itemQueryKey(query);
    const kept = found.get(key);
    if (kept) return kept;
    const items = queue.then(() => call(query));
    // A rejected query fails only itself: the next is still called, and it is searched again
    // when asked again.
    queue = items.catch(() => found.delete(key));
    found.set(key, items);
    return items;
  };
}
