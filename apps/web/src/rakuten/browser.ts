import * as v from "valibot";
import { DEV_PROXY_PATH, ITEM_SEARCH_ENDPOINT, RakutenConfigSchema } from "./config";
import { type ItemLookup, throttledLookup } from "./item-lookup";
import { lookupItem } from "./item-search";

/**
 * The item lookup for the browser, or `undefined` when the build had no Rakuten settings. The dev
 * server relays the calls, since the API does not answer a page on localhost.
 */
export function browserItemLookup(): ItemLookup | undefined {
  const config = v.safeParse(RakutenConfigSchema, import.meta.env.RAKUTEN_CONFIG);
  if (!config.success) return undefined;
  const endpoint = import.meta.env.DEV
    ? `${DEV_PROXY_PATH}${new URL(ITEM_SEARCH_ENDPOINT).pathname}`
    : ITEM_SEARCH_ENDPOINT;
  return throttledLookup((page) => lookupItem(config.output, page, { endpoint }));
}
