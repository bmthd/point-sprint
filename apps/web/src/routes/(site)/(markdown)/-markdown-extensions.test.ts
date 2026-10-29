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

test.each(["info", "success", "warning", "error"])(
  ":::%s holds its blocks in an alert",
  (status) => {
    const [node] = parse(
      `:::${status}\n買う前に[エントリー](https://example.com)してください。\n:::`,
    ).children;
    expect(node).toMatchObject({
      tagName: "md-alert",
      properties: { status },
      children: [{ type: "paragraph" }],
    });
    expect(node).not.toHaveProperty("properties.variant");
  },
);

test.each(["island", "plain", "solid", "subtle", "surface"])(
  ':::warning{variant="%s"} sets how the alert looks',
  (variant) => {
    const [node] = parse(`:::warning{variant="${variant}"}\n本文\n:::`).children;
    expect(node).toMatchObject({ properties: { status: "warning", variant } });
  },
);

test(":::button turns its one link into a button", () => {
  const [node] = parse(":::button\n[自分の買い物で確かめる](/)\n:::").children;
  expect(node).toMatchObject({
    tagName: "md-button",
    properties: { href: "/", label: "自分の買い物で確かめる" },
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
  { source: ":::info\n本文", error: "has no closing" },
  { source: ":::button\nリンクのない文\n:::", error: "one link" },
  { source: ":::button\n[一つ目](/)と[二つ目](/help)\n:::", error: "one link" },
  { source: ':::info{variant="bold"}\n本文\n:::', error: "variant" },
  { source: ':::info{title="注意"}\n本文\n:::', error: "only a variant" },
])("a broken block throws: $error", ({ source, error }) => {
  expect(() => parse(source)).toThrow(error);
});

test.each(["flow", "breakdown", "meter", "cards"])(
  ":::%s turns each row of its table into a row of cells named by their column",
  (name) => {
    const [node] = parse(
      `:::${name} 合計 1,500P\n| 名前 | 計算 | 値 |\n| --- | --- | --- |\n| 通常 | 税抜 50,000円 | 500P |\n| SPU | | 1,000P |\n:::`,
    ).children;
    expect(node).toMatchObject({
      tagName: `md-${name}`,
      properties: { argument: "合計 1,500P", names: '["通常","SPU"]', amounts: "[500,1000]" },
      children: [
        {
          tagName: `md-${name}-row`,
          properties: { index: "0" },
          children: [
            { tagName: "md-cell", properties: { label: "名前" } },
            { tagName: "md-cell", properties: { label: "計算" } },
            { tagName: "md-cell", properties: { label: "値" } },
          ],
        },
        {
          tagName: `md-${name}-row`,
          properties: { index: "1" },
          children: [{}, { tagName: "md-cell", properties: { label: "計算", empty: "true" } }, {}],
        },
      ],
    });
  },
);

test(":::compare makes a card of each column, named by the first column", () => {
  const [node] = parse(
    ":::compare\n|  | 通常分 | 特典分 |\n| --- | --- | --- |\n| 対象 | 税込 | 税抜 |\n| ポイント | 55P | 50P |\n:::",
  ).children;
  expect(node).toMatchObject({
    tagName: "md-compare",
    children: [
      {
        tagName: "md-compare-item",
        properties: { title: "通常分" },
        children: [
          { tagName: "md-cell", properties: { label: "対象" } },
          { tagName: "md-cell", properties: { label: "ポイント" } },
        ],
      },
      { tagName: "md-compare-item", properties: { title: "特典分" } },
    ],
  });
});

test.each(["flow", "breakdown", "meter", "cards", "compare"])(
  ":::%s without a table fails the build",
  (name) => {
    expect(() => parse(`:::${name}\n- 表ではない\n:::`)).toThrow(`:::${name} holds one table`);
  },
);
