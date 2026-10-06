import type { ChannelId } from "../model/common";
import { rakuma } from "./rakuma";
import { rakutenBooks } from "./rakuten-books";
import { rakutenIchiba } from "./rakuten-ichiba";
import type { ChannelDef, ParsedUrl } from "./types";

export type { ChannelDef, ParsedUrl } from "./types";

export const channels: Record<ChannelId, ChannelDef> = {
  "rakuten-ichiba": rakutenIchiba,
  "rakuten-books": rakutenBooks,
  rakuma,
};

export function parseUrl(input: string): ParsedUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  for (const channel of Object.values(channels)) {
    const parsed = channel.parseUrl(url);
    if (parsed) return parsed;
  }
  return null;
}

export function toItemCode(parsed: ParsedUrl): string | null {
  return parsed.shopCode && parsed.itemManageNumber
    ? `${parsed.shopCode}:${parsed.itemManageNumber}`
    : null;
}
