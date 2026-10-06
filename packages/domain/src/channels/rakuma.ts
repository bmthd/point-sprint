import type { ChannelDef } from "./types";

const HOSTS = new Set(["item.fril.jp", "fril.jp", "rakuma.rakuten.co.jp"]);

export const rakuma: ChannelDef = {
  id: "rakuma",
  label: "ラクマ",
  shopUnit: "single",
  countsTowardShopAround: true,
  receivesShopAround: false,
  supportsItemLookup: false,
  parseUrl(url) {
    return HOSTS.has(url.hostname) ? { channel: "rakuma" } : null;
  },
};
