import { parseMarkdown } from "@tanstack/markdown/parser";
import { expect, test } from "vitest";
import { guideExtensions } from "./markdown";

const parse = (source: string) => parseMarkdown(source, { extensions: guideExtensions });

test(":::items is a list of items, named by its query", () => {
  const nodes = parse('前の段落\n\n:::items{keyword="洗剤" hits=3}\n\n後の段落').children;
  expect(nodes.map((node) => node.type)).toEqual(["paragraph", "component", "paragraph"]);
  expect(nodes[1]).toMatchObject({
    tagName: "md-items",
    properties: { query: '{"hits":3,"keyword":"洗剤"}' },
  });
});
