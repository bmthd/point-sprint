import { campaignSources, campaignTemplates, standardSpu } from "@workspaces/domain";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { expect, test } from "vitest";
import template from "../../../markdown/calculation.md?raw";
import {
  calculationMarkdown,
  campaignListMarkdown,
  capSharingMarkdown,
  cardSplitMarkdown,
  exampleMarkdown,
  shopCountMarkdown,
  spuTableMarkdown,
  workedExample,
} from "./-calculation-markdown";
import { markdownExtensions } from "./-markdown-extensions";

test("the example is what the calculation gives: 50 + 55 + 50 + 50 points", () => {
  const { price, taxExcluded, tax, total } = workedExample();
  expect({ price, taxExcluded, tax, total }).toEqual({
    price: 5500,
    taxExcluded: 5000,
    tax: 500,
    total: 205,
  });
  expect(exampleMarkdown()).toContain(":::breakdown 合計 205P");
});

test("the card's two parts are 55 points on the price with tax and 50 on the price without", () => {
  expect(cardSplitMarkdown()).toContain("| ポイント | 55P | 50P |");
});

test("two plans of a month over the card's cap share it in proportion: 700 and 450 to 609 and 391", () => {
  const markdown = capSharingMarkdown();
  expect(markdown).toContain("| プランA（税抜 70,000円、上限がなければ 700P） | 609P |");
  expect(markdown).toContain("| プランB（税抜 45,000円、上限がなければ 450P） | 391P |");
  expect(markdown).toContain("2つを合わせると 1,150P で上限を超える");
});

test("a shop counts once its orders add up to 1,000円, and the count is the calculation's", () => {
  const markdown = shopCountMarkdown();
  expect(markdown).toContain("| ショップA | 1店舗 | 3,300円（2回の注文） |");
  expect(markdown).toContain("| ショップB | 数えない | 880円 |");
  expect(markdown).toContain("この例の買いまわりは 2店舗 です。");
});

test.each(standardSpu)("the SPU table has $label", ({ label }) => {
  expect(spuTableMarkdown()).toContain(label);
});

test.each(campaignTemplates)(
  "the campaign cards have $name unless the user enters its rates",
  ({ id, name }) => {
    const cards = campaignListMarkdown();
    if (campaignSources[id]?.kind === "user-entered") expect(cards).not.toContain(`| ${name} |`);
    else expect(cards).toContain(`| ${name} |`);
  },
);

test("the campaign cards say which source is not Rakuten's", () => {
  expect(campaignListMarkdown()).toMatch(/\| リピート購入 \|.*楽天の公式ではありません/);
});

test("the page fills every placeholder and every figure parses", () => {
  const markdown = calculationMarkdown(template);
  expect(markdown).not.toContain("{{");
  expect(() => parseMarkdown(markdown, { extensions: markdownExtensions })).not.toThrow();
});
