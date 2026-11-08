import { type ItemLookup, cachedLookup } from "#/rakuten/item-lookup.ts";

/**
 * The item lookup through the Worker, which alone holds the Rakuten API's keys, with found items
 * kept for five minutes.
 */
export const workerItemLookup: ItemLookup = cachedLookup(async (page, { maxWaitMs, signal }) => {
  try {
    const { lookupItem } = await import("#/server/item-lookup/item-lookup.functions.ts");
    return await lookupItem({ data: { page, maxWaitMs }, ...(signal ? { signal } : {}) });
  } catch {
    return { ok: false, error: { reason: "network" } };
  }
});
