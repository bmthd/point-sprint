import type { ItemPage, LookupResult } from "./item-search";

export type ItemLookup = (page: ItemPage) => Promise<LookupResult>;

type Options = {
  /** The least time between two calls: the API answers 429 above about one call a second. */
  intervalMs?: number;
  /** How long a found item is reused for the same item page. */
  cacheMs?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `lookup` with calls spaced out by `intervalMs`, and found items kept for `cacheMs`. A lookup of
 * an item page already on its way shares that call. Failures are not kept, so they can be tried
 * again.
 */
export function throttledLookup(
  lookup: ItemLookup,
  { intervalMs = 1100, cacheMs = 5 * 60_000, now = Date.now, wait = sleep }: Options = {},
): ItemLookup {
  const cache = new Map<string, { at: number; result: Promise<LookupResult> }>();
  let nextCallAt = 0;

  const call = async (page: ItemPage) => {
    const at = Math.max(now(), nextCallAt);
    nextCallAt = at + intervalMs;
    if (at > now()) await wait(at - now());
    return lookup(page);
  };

  return (page) => {
    const key = `${page.shopCode}/${page.itemManageNumber}`;
    const kept = cache.get(key);
    if (kept && now() - kept.at < cacheMs) return kept.result;
    const result = call(page);
    cache.set(key, { at: now(), result });
    void result.then((settled) => {
      if (!settled.ok && cache.get(key)?.result === result) cache.delete(key);
    });
    return result;
  };
}
