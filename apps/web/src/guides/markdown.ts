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

/** The syntax a guide may use: that of the other Markdown pages, and the item lists. */
export const guideExtensions = [...markdownExtensions, items];
