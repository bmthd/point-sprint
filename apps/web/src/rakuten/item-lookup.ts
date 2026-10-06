import type { LookupResult } from "./item-search";

export type ItemLookup = (itemCode: string) => Promise<LookupResult>;

type Options = {
  /** The least time between two calls: the API answers 429 above about one call a second. */
  intervalMs?: number;
  /** How long a found item is reused for the same item code. */
  cacheMs?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `lookup` with calls spaced out by `intervalMs`, and found items kept for `cacheMs`. A lookup of
 * an item code already on its way shares that call. Failures are not kept, so they can be tried
 * again.
 */
export function throttledLookup(
  lookup: ItemLookup,
  { intervalMs = 1100, cacheMs = 5 * 60_000, now = Date.now, wait = sleep }: Options = {},
): ItemLookup {
  const cache = new Map<string, { at: number; result: Promise<LookupResult> }>();
  let nextCallAt = 0;

  const call = async (itemCode: string) => {
    const at = Math.max(now(), nextCallAt);
    nextCallAt = at + intervalMs;
    if (at > now()) await wait(at - now());
    return lookup(itemCode);
  };

  return (itemCode) => {
    const kept = cache.get(itemCode);
    if (kept && now() - kept.at < cacheMs) return kept.result;
    const result = call(itemCode);
    cache.set(itemCode, { at: now(), result });
    void result.then((settled) => {
      if (!settled.ok && cache.get(itemCode)?.result === result) cache.delete(itemCode);
    });
    return result;
  };
}
