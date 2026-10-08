import { getRequest } from "@tanstack/react-start/server";
import * as v from "valibot";
import { ALLOWED_ORIGIN, ITEM_SEARCH_ENDPOINT, RakutenConfigSchema } from "../rakuten/config";
import { searchItems } from "../rakuten/item-search";
import { guideItemSearch } from "./guide-items";
import { loadGuide } from "./load-guide";

/** The search the guides share, or `undefined` when the build had no Rakuten settings. */
function serverItemSearch() {
  const config = v.safeParse(RakutenConfigSchema, import.meta.env.RAKUTEN_CONFIG);
  if (!config.success) return undefined;
  const endpoint = import.meta.env.GUIDE_ITEMS_ENDPOINT ?? ITEM_SEARCH_ENDPOINT;
  return guideItemSearch((params) =>
    searchItems(config.output, params, { endpoint, origin: ALLOWED_ORIGIN }),
  );
}

const search = serverItemSearch();

/**
 * Whether the build is prerendering: it serves the Worker on localhost (so does `pnpm dev`),
 * while the deployed Worker is reached only at the site's domain. `TSS_PRERENDERING` would say so,
 * but it is set in Node, and the Worker does not see it.
 */
const isPrerendering = () => new URL(getRequest().url).hostname === "localhost";

/**
 * The guide, with its items searched only while the build prerenders it. The deployed Worker
 * never calls the API for them, so that calls from outside cannot use up the API's rate, which
 * the item lookup in the browser shares: there, the guide has no items.
 */
export const loadGuideOnServer = (slug: string) =>
  loadGuide(slug, isPrerendering() ? search : undefined);
