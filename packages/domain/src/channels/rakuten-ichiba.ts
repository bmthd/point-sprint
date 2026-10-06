import type { ChannelDef } from "./types";

const SHOP_CODE_PATTERN = /^[a-z0-9_-]+$/i;

/** First path segments on www.rakuten.co.jp that are not shop codes. `gold` is handled separately. */
// cspell:ignore myhelp
const RESERVED_PATHS = new Set([
  "search",
  "category",
  "event",
  "gold",
  "ranking",
  "review",
  "point",
  "coupon",
  "campaign",
  "info",
  "myhelp",
  "ec",
]);

export const rakutenIchiba: ChannelDef = {
  id: "rakuten-ichiba",
  label: "楽天市場",
  shopUnit: "per-shop",
  countsTowardShopAround: true,
  receivesShopAround: true,
  supportsItemLookup: true,
  parseUrl(url) {
    const [shopCode, itemManageNumber] = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "item.rakuten.co.jp") {
      if (!shopCode) return null;
      return itemManageNumber
        ? { channel: "rakuten-ichiba", shopCode, itemManageNumber }
        : { channel: "rakuten-ichiba", shopCode };
    }
    if (url.hostname === "www.rakuten.co.jp") {
      if (!shopCode) return null;
      // GOLD stores live at /gold/<shop>/.
      const code = shopCode === "gold" ? itemManageNumber : shopCode;
      if (shopCode !== "gold" && RESERVED_PATHS.has(shopCode)) return null;
      if (!code || !SHOP_CODE_PATTERN.test(code)) return null;
      return { channel: "rakuten-ichiba", shopCode: code };
    }
    return null;
  },
};
