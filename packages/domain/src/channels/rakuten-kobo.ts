import type { ChannelDef } from "./types";

export const rakutenKobo: ChannelDef = {
  id: "rakuten-kobo",
  label: "楽天Kobo",
  shopUnit: "single",
  countsTowardShopAround: true,
  receivesShopAround: true,
  supportsItemLookup: false,
  parseUrl(url) {
    // Kobo の商品は楽天ブックスと同じホストの /rk/ の下にある。
    return url.hostname === "books.rakuten.co.jp" && url.pathname.startsWith("/rk/")
      ? { channel: "rakuten-kobo" }
      : null;
  },
};
