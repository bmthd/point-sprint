import type { RakutenItem, SearchResult } from "../rakuten/item-search.ts";
import { type ItemQuery, itemQueriesIn, itemQueryKey } from "./item-query.ts";

// The items of the guides' `:::items{…}` lists, fetched once by the build and put in the pages.

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

export type GuideItems = {
  /** When the build fetched the items: the prices shown are the ones at that time. */
  fetchedAt: string;
  /** The items of each query, by `itemQueryKey`. A query whose call failed has none. */
  lists: Record<string, GuideItem[]>;
};

/** A call to the item search API, with the build's settings. */
export type ItemSearch = (params: Record<string, string | number>) => Promise<SearchResult>;

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
  now?: () => Date;
  warn?: (message: string) => void;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The items of every list in `markdowns`. The same query is called once, and the calls are made
 * one after another, `intervalMs` apart. A failed call, or no `search` (a build without the
 * Rakuten settings), leaves its lists empty: the build goes on, and the pages show their text.
 */
export async function collectGuideItems(
  markdowns: string[],
  search: ItemSearch | undefined,
  { intervalMs = 1100, wait = sleep, now = () => new Date(), warn = console.warn }: Options = {},
): Promise<GuideItems> {
  const queries = new Map<string, ItemQuery>();
  for (const query of markdowns.flatMap(itemQueriesIn)) queries.set(itemQueryKey(query), query);
  const fetchedAt = now().toISOString();
  if (!search) return { fetchedAt, lists: {} };

  const lists: Record<string, GuideItem[]> = {};
  let first = true;
  for (const [key, query] of queries) {
    if (!first) await wait(intervalMs);
    first = false;
    // Only items with an image: a list without pictures does not help choose.
    const params = Object.entries(query).filter(([, value]) => value !== undefined);
    const result = await search({ ...Object.fromEntries(params), imageFlag: 1 });
    if (result.ok) lists[key] = shownItems(result.items);
    else warn(`The items for ${key} were not fetched (${JSON.stringify(result.error)}).`);
  }
  return { fetchedAt, lists };
}
