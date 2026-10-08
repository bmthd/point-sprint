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

/** The items of a query, or `undefined` when they could not be searched. */
export type GuideItemSearch = (query: ItemQuery) => Promise<GuideItem[] | undefined>;

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
  wait?: (ms: number) => Promise<void>;
  warn?: (message: string) => void;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `search` for the guides' lists. The build prerenders the guides side by side, so the calls of
 * every guide are queued one after another, `intervalMs` apart, and a query is called once. A
 * failed call is not retried: its list is left out, and the build goes on.
 */
export function guideItemSearch(
  search: ItemSearch,
  { intervalMs = 1100, wait = sleep, warn = console.warn }: Options = {},
): GuideItemSearch {
  const found = new Map<string, Promise<GuideItem[] | undefined>>();
  let queue: Promise<unknown> = Promise.resolve();
  let called = false;

  const call = async (query: ItemQuery) => {
    if (called) await wait(intervalMs);
    called = true;
    const params = Object.entries(query).filter(([, value]) => value !== undefined);
    // Only items with an image: a list without pictures does not help choose.
    const result = await search({ ...Object.fromEntries(params), imageFlag: 1 });
    if (result.ok) return shownItems(result.items);
    warn(`The items for ${itemQueryKey(query)} were not found (${JSON.stringify(result.error)}).`);
    return undefined;
  };

  return (query) => {
    const key = itemQueryKey(query);
    const kept = found.get(key);
    if (kept) return kept;
    const items = queue.then(() => call(query));
    queue = items;
    found.set(key, items);
    return items;
  };
}
