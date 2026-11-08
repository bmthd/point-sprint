import type { ChannelDef } from "./types.ts";

export const rakutenBooks: ChannelDef = {
  id: "rakuten-books",
  label: "楽天ブックス",
  shopUnit: "single",
  countsTowardShopAround: true,
  receivesShopAround: true,
  supportsItemLookup: false,
  parseUrl(url) {
    return url.hostname === "books.rakuten.co.jp" ? { channel: "rakuten-books" } : null;
  },
};
