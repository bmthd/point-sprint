import { parseMarkdown } from "@tanstack/markdown/parser";
import { expect, test } from "vitest";
import help from "#/routes/(site)/(markdown)/-markdown/help.md?raw";
import { figureExtension } from "./figure-extension.ts";
import { helpFigureMarks } from "./figure-marks.ts";

test("figure directives pass their name attribute and numbered explanations", () => {
  const parsed = parseMarkdown(
    ':::figure[プランの一覧]{name="plan" alt="保存したプランの画面"}\n1. 注文はプランごとに保存されます。\n:::',
    {
      extensions: [figureExtension],
    },
  );
  expect(parsed.children[0]).toMatchObject({
    tagName: "md-figure",
    properties: { name: "plan", caption: "プランの一覧", alt: "保存したプランの画面" },
    children: [{ tagName: "md-figure-callout", properties: { step: "1" } }],
  });
});

test.each([
  [":::figure plan\n1. 説明\n:::", /Use :::figure/],
  [':::figure{name="plan"}\n1. 説明\n:::', /Use :::figure/],
  [':::figure[説明]{name="plan"}\n1. 説明\n:::', /needs name and alt/],
  [':::figure[説明]{alt="画面"}\n1. 説明\n:::', /needs name and alt/],
  [':::figure[説明]{name="plan" alt=" "}\n1. 説明\n:::', /needs name and alt/],
  [':::figure[説明]{name="plan" alt="画面" other="値"}\n1. 説明\n:::', /unknown or duplicate/],
  [':::figure[説明]{name="plan" alt="画面" alt="重複"}\n1. 説明\n:::', /unknown or duplicate/],
  [':::figure[説明]{name="plan" alt=画面}\n1. 説明\n:::', /must be quoted/],
  [':::figure[説明]{name="missing" alt="画面"}\n1. 説明\n:::', /has no figure/],
  [':::figure[説明]{name="plan" alt="画面"}\n1. 説明', /has no closing/],
  [':::figure[説明]{name="plan" alt="画面"}\n本文\n:::', /numbered list/],
  [':::figure[説明]{name="plan" alt="画面"}\n1. 説明\n2. 説明\n:::', /marks but/],
])("invalid figure directive fails: %s", (source, error) => {
  expect(() => parseMarkdown(source, { extensions: [figureExtension] })).toThrow(error);
});

test("all help figures carry their caption and alternative text in Markdown", () => {
  const nodes = parseMarkdown(help, { extensions: [figureExtension] }).children.filter(
    (node) => node.type === "component" && node.tagName === "md-figure",
  );
  expect(nodes).toHaveLength(Object.keys(helpFigureMarks).length);
  for (const node of nodes) {
    if (node.type !== "component") throw new Error("Expected a figure");
    expect(node.properties?.caption).toEqual(expect.any(String));
    expect(node.properties?.alt).toEqual(expect.any(String));
    expect(node.properties?.caption).not.toBe("");
    expect(node.properties?.alt).not.toBe("");
  }
});

test("figure attributes may be reordered without changing the text", () => {
  const parsed = parseMarkdown(
    ':::figure[プランの一覧]{alt="保存したプランの画面" name="plan"}\n1. 説明\n:::',
    {
      extensions: [figureExtension],
    },
  );
  expect(parsed.children[0]).toMatchObject({
    properties: { name: "plan", caption: "プランの一覧", alt: "保存したプランの画面" },
  });
});
