import { parseMarkdown } from "@tanstack/markdown/parser";
import { expect, test } from "vitest";
import { guideExtensions, rakutenAffiliateUrl } from "./markdown";

const parse = (source: string) => parseMarkdown(source, { extensions: guideExtensions });

test(":::items is a list of items, named by its query", () => {
  const nodes = parse('前の段落\n\n:::items{keyword="洗剤" hits=3}\n\n後の段落').children;
  expect(nodes.map((node) => node.type)).toEqual(["paragraph", "component", "paragraph"]);
  expect(nodes[1]).toMatchObject({
    tagName: "md-items",
    properties: { query: '{"hits":3,"keyword":"洗剤"}' },
  });
});

test(":rakuten[…](…) is a link to a Rakuten page, its label kept", () => {
  const [paragraph] = parse(
    "対象は:rakuten[楽天ブックス](https://books.rakuten.co.jp/)です。",
  ).children;
  expect(paragraph).toMatchObject({
    type: "paragraph",
    children: [
      { type: "text", value: "対象は" },
      {
        type: "inlineComponent",
        tagName: "md-rakuten-link",
        properties: { href: "https://books.rakuten.co.jp/" },
        children: [{ type: "text", value: "楽天ブックス" }],
      },
      { type: "text", value: "です。" },
    ],
  });
});

test("an affiliate link carries the page in pc and m; without an affiliate id, it is the page", () => {
  const page = "https://books.rakuten.co.jp/";
  const url = new URL(rakutenAffiliateUrl(page, "abc.def"));
  expect(url.origin + url.pathname).toBe("https://hb.afl.rakuten.co.jp/hgc/abc.def/");
  expect(url.searchParams.get("pc")).toBe(page);
  expect(url.searchParams.get("m")).toBe(page);
  expect(rakutenAffiliateUrl(page, null)).toBe(page);
});
