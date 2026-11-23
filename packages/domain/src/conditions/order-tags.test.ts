import { expect, test } from "vitest";
import { campaignTemplates } from "#/master/campaigns.ts";
import { hasOrderTagCampaign } from "./order-tags.ts";

const campaign = campaignTemplates.find((template) => template.id === "24h");
if (!campaign) throw new Error("24時間限定のテンプレートが必要です");
const benefit = campaign.benefit;

test("注文タグの条件を持つキャンペーンを判定する", () => {
  expect(hasOrderTagCampaign([], "24h")).toBe(false);
  expect(hasOrderTagCampaign([benefit], "24h")).toBe(true);
  expect(hasOrderTagCampaign([benefit], "brand-day")).toBe(false);
  expect(hasOrderTagCampaign([{ ...benefit, conditions: {} }], "24h")).toBe(false);
});

test("無効なキャンペーンでも注文タグの入力対象として残す", () => {
  expect(hasOrderTagCampaign([{ ...benefit, enabled: false }], "24h")).toBe(true);
});
