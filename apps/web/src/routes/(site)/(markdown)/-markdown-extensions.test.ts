import { parseMarkdown } from "@tanstack/markdown/parser";
import { expect, test } from "vitest";
import { markdownExtensions } from "./-markdown-extensions";

const parse = (source: string) => parseMarkdown(source, { extensions: markdownExtensions });

test(":::details holds its heading and its blocks", () => {
  const [node] = parse(
    ":::details 保留\n保留中の注文は合計に入りません。\n\n2段落目\n:::",
  ).children;
  expect(node).toMatchObject({
    type: "component",
    tagName: "md-details",
    properties: { summary: "保留" },
    children: [{ type: "paragraph" }, { type: "paragraph" }],
  });
});

test(":::timeline turns each item of its numbered list into a numbered step", () => {
  const [node] = parse(":::timeline\n1. プランを作る\n2. 注文を追加する\n:::").children;
  expect(node).toMatchObject({
    tagName: "md-timeline",
    children: [
      { tagName: "md-timeline-step", properties: { step: "1" } },
      { tagName: "md-timeline-step", properties: { step: "2" } },
    ],
  });
});

test("the closing may be indented, as the formatter writes it after a list", () => {
  const nodes = parse(":::timeline\n1. プランを作る\n   :::\n\n続きの段落").children;
  expect(nodes.map((node) => node.type)).toEqual(["component", "paragraph"]);
});

test("text after the block is parsed as usual", () => {
  const nodes = parse(":::details 保留\n本文\n:::\n\n続きの段落").children;
  expect(nodes.map((node) => node.type)).toEqual(["component", "paragraph"]);
});

test.each([
  { source: ":::details 保留\n本文", error: "has no closing" },
  { source: ":::details\n本文\n:::", error: "needs a heading" },
  { source: ":::timeline\n- 番号のない一覧\n:::", error: "one numbered list" },
  { source: ":::timeline\n1. 手順\n\n段落\n:::", error: "one numbered list" },
])("a broken block throws: $error", ({ source, error }) => {
  expect(() => parse(source)).toThrow(error);
});
