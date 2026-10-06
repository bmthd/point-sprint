import * as v from "valibot";
import { expect, test } from "vitest";
import { BenefitSchema } from "../model/benefit";
import { CampaignTemplateSchema } from "../model/campaign-template";
import { OfficialEventSchema } from "../model/official-event";
import { campaignTemplates } from "./campaigns";
import { officialEvents } from "./events";
import { instantiateCampaign } from "./instantiate";
import { standardSpu } from "./spu";

test("standard SPU parses", () => {
  for (const benefit of standardSpu) {
    expect(v.parse(BenefitSchema, benefit)).toEqual(benefit);
    expect(["base", "spu"]).toContain(benefit.category);
  }
});

test("standard SPU includes base points", () => {
  const base = standardSpu.filter(
    (b) => b.kind === "rate-bonus" && b.params.rate === 1 && b.params.cap === undefined,
  );
  expect(base.length).toBeGreaterThanOrEqual(1);
  expect(base.some((b) => b.kind === "rate-bonus" && b.params.roundingUnit === "item")).toBe(true);
});

test("official events parse", () => {
  for (const event of officialEvents) {
    v.parse(OfficialEventSchema, event);
    expect(event.period.start <= event.period.end).toBe(true);
  }
});

test("benefit ids are unique across SPU and every event", () => {
  const ids = [...standardSpu, ...officialEvents.flatMap((e) => e.benefits)].map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("card normal and card SPU are separate benefits", () => {
  const rateOne = standardSpu.filter((b) => b.kind === "rate-bonus" && b.params.rate === 1);
  expect(
    rateOne.some(
      (b) =>
        b.kind === "rate-bonus" && b.amountBasis === "tax-included" && b.params.cap === undefined,
    ),
  ).toBe(true);
  expect(
    rateOne.some((b) => b.kind === "rate-bonus" && b.params.cap === 1000 && b.capScope === "month"),
  ).toBe(true);
});

test("capped SPU items are monthly", () => {
  const capped = standardSpu.filter((b) => b.kind === "rate-bonus" && b.params.cap !== undefined);
  expect(capped.length).toBeGreaterThan(0);
  for (const benefit of capped) expect(benefit.capScope).toBe("month");
});

test("campaign templates parse", () => {
  for (const template of campaignTemplates) {
    v.parse(CampaignTemplateSchema, template);
    expect(template.benefit.category).toBe("campaign");
    expect(template.benefit.enabled).toBe(false);
  }
  const ids = [
    ...standardSpu,
    ...officialEvents.flatMap((e) => e.benefits),
    ...campaignTemplates.map((t) => t.benefit),
  ].map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
  const templateIds = campaignTemplates.map((t) => t.id);
  expect(new Set(templateIds).size).toBe(templateIds.length);
});

test("master benefits carry their legacy image paths into plans", () => {
  expect(standardSpu.find((benefit) => benefit.label === "楽天モバイル")?.imagePath).toBe(
    "/img/spu/service_mobile_v2.webp",
  );
  const sports = campaignTemplates.find((template) => template.id === "sports-win");
  if (!sports) throw new Error("no sports-win campaign");
  expect(
    instantiateCampaign(sports, {
      id: "b0000000-0000-4000-8000-000000000099",
      dates: ["2026-10-06"],
      rate: 2,
    }).imagePath,
  ).toBe("/img/campaign/sports-w.webp");
});

test("every SPU tile has a service image", () => {
  const tiles = standardSpu.filter((benefit) => benefit.label !== "通常ポイント");
  expect(tiles.every((benefit) => benefit.imagePath !== undefined)).toBe(true);
  expect(tiles.every((benefit) => benefit.imagePath?.endsWith(".webp"))).toBe(true);
});

test("every master image uses WebP", () => {
  const paths = [
    ...standardSpu.map((benefit) => benefit.imagePath),
    ...campaignTemplates.map((template) => template.benefit.imagePath),
  ].filter((path) => path !== undefined);
  expect(paths.every((path) => path.endsWith(".webp"))).toBe(true);
});

test("base points and card normal are in the base category", () => {
  const base = standardSpu.filter((b) => b.category === "base").map((b) => b.label);
  expect(base).toEqual(["通常ポイント", "楽天カード通常分（カード本体の還元）"]);
});

test("premium card SPU has a 5,000 point monthly cap", () => {
  const premium = standardSpu.find((b) => b.label === "楽天プレミアムカード（特典分）");
  expect(premium?.kind).toBe("rate-bonus");
  if (premium?.kind !== "rate-bonus") return;
  expect(premium.params.cap).toBe(5000);
  expect(premium.capScope).toBe("month");
  expect(premium.enabled).toBe(false);
  expect(premium.exclusiveGroup).toBe("rakuten-card");
  const regular = standardSpu.find((b) => b.label === "楽天カード特典分（SPU）");
  expect(regular?.exclusiveGroup).toBe("rakuten-card");
});
