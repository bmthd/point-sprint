import type { ChannelId } from "../model/common";
import { rakutenBooks } from "./rakuten-books";
import { rakutenIchiba } from "./rakuten-ichiba";
import { rakutenKobo } from "./rakuten-kobo";
import type { ChannelDef, ParsedUrl } from "./types";

export type { ChannelDef, ParsedUrl } from "./types";

export const channels: Record<ChannelId, ChannelDef> = {
  "rakuten-ichiba": rakutenIchiba,
  "rakuten-books": rakutenBooks,
  "rakuten-kobo": rakutenKobo,
};

export function parseUrl(input: string): ParsedUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  // Kobo の /rk/ を楽天ブックスより先に見る。
  for (const channel of [rakutenIchiba, rakutenKobo, rakutenBooks]) {
    const parsed = channel.parseUrl(url);
    if (parsed) return parsed;
  }
  return null;
}
