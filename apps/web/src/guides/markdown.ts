import type { MarkdownExtension } from "@tanstack/markdown";
import { markdownExtensions } from "../routes/(site)/(markdown)/-markdown-extensions";
import { itemQueryKey, parseItemsLine } from "./item-query";

/** `:::items{keyword="…" hits=6}` on a line of its own: a list of Rakuten items found by the build. */
const items: MarkdownExtension = {
  name: "items",
  parseBlock(context) {
    const query = parseItemsLine(context.lines[context.index] ?? "");
    if (!query) return undefined;
    context.consume(1);
    return {
      type: "component",
      name: "items",
      tagName: "md-items",
      attributes: {},
      properties: { query: itemQueryKey(query) },
      children: [],
    };
  },
};

/** `:rakuten[楽天ブックス](https://books.rakuten.co.jp/)`: a link to a Rakuten page that pays as an affiliate link. */
const rakutenLink: MarkdownExtension = {
  name: "rakuten-link",
  inlineParser: {
    markers: ":",
    parse(context) {
      const link = context.source
        .slice(context.index)
        .match(/^:rakuten\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/);
      if (!link?.[1] || !link[2]) return undefined;
      return {
        node: {
          type: "inlineComponent",
          name: "rakuten-link",
          tagName: "md-rakuten-link",
          attributes: {},
          properties: { href: link[2] },
          children: context.parseInline(link[1]),
        },
        length: link[0].length,
      };
    },
  },
};

/**
 * The affiliate link to a Rakuten page, or the page itself without an affiliate id: a build without
 * the settings still links to the shop.
 */
export function rakutenAffiliateUrl(page: string, affiliateId: string | null | undefined) {
  if (!affiliateId) return page;
  const encoded = encodeURIComponent(page);
  return `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}/?pc=${encoded}&m=${encoded}`;
}

/** The syntax a guide may use: that of the other Markdown pages, the item lists, and the links to Rakuten. */
export const guideExtensions = [...markdownExtensions, items, rakutenLink];
