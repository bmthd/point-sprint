import type { ChannelId } from "../model/common";

export type ParsedUrl = { channel: ChannelId; shopCode?: string; itemManageNumber?: string };

export interface ChannelDef {
  id: ChannelId;
  label: string;
  shopUnit: "per-shop" | "single";
  countsTowardShopAround: boolean;
  receivesShopAround: boolean;
  supportsItemLookup: boolean;
  parseUrl(url: URL): ParsedUrl | null;
}
