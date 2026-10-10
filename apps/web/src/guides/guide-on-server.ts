import { getRequest } from "@tanstack/react-start/server";
import { ALLOWED_ORIGIN, ITEM_SEARCH_ENDPOINT } from "../rakuten/config";
import { searchItems } from "../rakuten/item-search";
import { workerRakutenConfig } from "../server/worker-rakuten-config";
import { type GuideItemSearch, guideItemSearch } from "./guide-items";
import { loadGuide } from "./load-guide";

let search: GuideItemSearch | undefined;

/**
 * The search the guides share, or `undefined` when the Worker has no Rakuten settings. Made on
 * the first guide, so that the guides prerendered side by side queue their calls together.
 */
function serverItemSearch() {
  const config = workerRakutenConfig();
  if (!config) return undefined;
  const endpoint = import.meta.env.GUIDE_ITEMS_ENDPOINT ?? ITEM_SEARCH_ENDPOINT;
  search ??= guideItemSearch((params) =>
    searchItems(config, params, { endpoint, origin: ALLOWED_ORIGIN }),
  );
  return search;
}

/**
 * Whether the build is prerendering: it serves the Worker on localhost (so does `pnpm dev`),
 * while the deployed Worker is reached only at the site's domain. `TSS_PRERENDERING` would say so,
 * but it is set in Node, and the Worker does not see it.
 */
const isPrerendering = () => new URL(getRequest().url).hostname === "localhost";

/**
 * The guide, with its items searched only while the build prerenders it. The deployed Worker
 * never calls the API for them, so that calls from outside cannot use up the API's rate, which
 * the item lookup shares: there, the guide has no items.
 */
export const loadGuideOnServer = (slug: string) =>
  loadGuide(slug, isPrerendering() ? serverItemSearch() : undefined);
