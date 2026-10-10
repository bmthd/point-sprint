import { ALLOWED_ORIGIN, ITEM_SEARCH_ENDPOINT, type RakutenConfig } from "../rakuten/config";
import type { ItemLookupResult, LookupItemInput } from "../rakuten/item-lookup";
import { searchItemPage } from "../rakuten/item-search";
import type { Turn } from "./rate-gate";

export type ItemLookupDeps = {
  /** The Worker's Rakuten settings; `undefined` when it has none. */
  config: RakutenConfig | undefined;
  /** Asks the rate gate for a turn at the API. */
  takeTurn: (maxWaitMs: number) => Promise<Turn>;
  wait?: (ms: number) => Promise<void>;
  endpoint?: string;
  fetch?: typeof fetch;
  /** Aborted when the browser gives up on the lookup. */
  signal?: AbortSignal;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Looks up the item on an item page once its turn at the API comes, or says how far away the turn
 * is when that is more than `maxWaitMs`.
 */
export async function handleItemLookup(
  { page, maxWaitMs }: LookupItemInput,
  {
    config,
    takeTurn,
    wait = sleep,
    endpoint = ITEM_SEARCH_ENDPOINT,
    fetch,
    signal,
  }: ItemLookupDeps,
): Promise<ItemLookupResult> {
  if (!config) return { ok: false, error: { reason: "unavailable" } };
  const turn = await takeTurn(maxWaitMs);
  if (!turn.granted) return { ok: false, error: { reason: "busy", waitMs: turn.waitMs } };
  if (turn.waitMs > 0) await wait(turn.waitMs);
  // The turn is let go: the browser no longer waits for the answer.
  if (signal?.aborted) return { ok: false, error: { reason: "network" } };
  return searchItemPage(config, page, {
    endpoint,
    origin: ALLOWED_ORIGIN,
    ...(fetch ? { fetch } : {}),
    ...(signal ? { signal } : {}),
  });
}
