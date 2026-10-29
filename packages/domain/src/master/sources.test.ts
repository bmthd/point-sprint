import { expect, test } from "vitest";
import { campaignTemplates } from "./campaigns";
import { type BenefitSource, campaignSources, spuSource } from "./sources";
import { standardSpu } from "./spu";

const expectCited = (source: BenefitSource | undefined) => {
  expect(source).toBeDefined();
  if (source === undefined || source.kind === "user-entered") return;
  expect(source.url).toMatch(/^https:\/\//);
  expect(source.title.trim()).not.toBe("");
  expect(new Date(`${source.checkedOn}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
    source.checkedOn,
  );
};

test.each(standardSpu)("the SPU $label cites Rakuten's page", (benefit) => {
  const source = spuSource(benefit);
  expect(source.kind).toBe("official");
  expectCited(source);
});

test.each(campaignTemplates)("the campaign $name has a source", ({ id }) => {
  expectCited(campaignSources[id]);
});

test("every campaign source is a campaign's", () => {
  const ids = new Set(campaignTemplates.map((template) => template.id));
  expect(Object.keys(campaignSources).filter((id) => !ids.has(id))).toEqual([]);
});
