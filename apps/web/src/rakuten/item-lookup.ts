import * as v from "valibot";
import type { ItemPage, LookupFailure, RakutenItem } from "./item-search";

// The item lookup as the browser asks the Worker for it (`src/server/lookup-item.ts`).

/** How long the first lookup of a URL may wait for its turn at the API. */
export const FIRST_MAX_WAIT_MS = 5_000;

/** How long a lookup may wait when the user chose to wait. A longer wait is not offered. */
export const LONGEST_WAIT_MS = 30_000;

export const LookupItemInputSchema = v.object({
  page: v.object({
    shopCode: v.pipe(v.string(), v.nonEmpty(), v.maxLength(100)),
    itemManageNumber: v.pipe(v.string(), v.nonEmpty(), v.maxLength(200)),
  }),
  maxWaitMs: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(LONGEST_WAIT_MS)),
});

export type LookupItemInput = v.InferOutput<typeof LookupItemInputSchema>;

export type ItemLookupFailure =
  | LookupFailure
  /** Its turn at the API was more than `maxWaitMs` away; `waitMs` is how far. */
  | { reason: "busy"; waitMs: number }
  /** The Worker has no Rakuten settings. */
  | { reason: "unavailable" };

export type ItemLookupResult =
  | { ok: true; item: RakutenItem }
  | { ok: false; error: ItemLookupFailure };

export type ItemLookupOptions = { maxWaitMs: number; signal?: AbortSignal };

export type ItemLookup = (page: ItemPage, options: ItemLookupOptions) => Promise<ItemLookupResult>;

type Options = {
  /** How long a found item is reused for the same item page. */
  cacheMs?: number;
  now?: () => number;
};

/** `lookup` with found items kept for `cacheMs`. Failures are not kept, so they can be tried again. */
export function cachedLookup(
  lookup: ItemLookup,
  { cacheMs = 5 * 60_000, now = Date.now }: Options = {},
): ItemLookup {
  const cache = new Map<string, { at: number; item: RakutenItem }>();
  return async (page, options) => {
    const key = `${page.shopCode}/${page.itemManageNumber}`;
    const kept = cache.get(key);
    if (kept && now() - kept.at < cacheMs) return { ok: true, item: kept.item };
    const result = await lookup(page, options);
    if (result.ok) cache.set(key, { at: now(), item: result.item });
    return result;
  };
}
