import { campaignSources, campaignTemplates, standardSpu } from "@workspaces/domain";
import { expect, test } from "vitest";
import template from "../../../markdown/calculation.md?raw";
import {
  calculationMarkdown,
  campaignListMarkdown,
  exampleMarkdown,
  spuTableMarkdown,
} from "./-calculation-markdown";

test("the example is what the calculation gives: 50 + 55 + 50 + 50 points", () => {
  const { markdown, total } = exampleMarkdown();
  expect(total).toBe(205);
  expect(markdown).toContain("205P");
  expect(markdown).toContain("5,500円");
  expect(markdown).toContain("5,000円");
});

test.each(standardSpu)("the SPU table has $label", ({ label }) => {
  expect(spuTableMarkdown()).toContain(label);
});

test.each(campaignTemplates)(
  "the campaign list has $name unless the user enters its rates",
  ({ id, name }) => {
    const list = campaignListMarkdown();
    if (campaignSources[id]?.kind === "user-entered") expect(list).not.toContain(`- ${name}:`);
    else expect(list).toContain(`- ${name}:`);
  },
);

test("the campaign list says which source is not Rakuten's", () => {
  expect(campaignListMarkdown()).toMatch(/- リピート購入:.*楽天の公式ではありません/);
});

test("the page fills every placeholder", () => {
  expect(calculationMarkdown(template)).not.toContain("{{");
});
