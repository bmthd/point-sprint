import { expect, test } from "vitest";
import { campaignTemplates, instantiateCampaign, type Plan } from "@workspaces/domain";
import { defaultInput } from "./campaign-adder.tsx";

const plan: Plan = {
  id: "a0000000-0000-4000-8000-000000000001",
  updatedAt: "2026-10-01T00:00:00Z",
  name: "テスト",
  period: { start: "2026-10-20", end: "2026-10-21" },
  benefits: [],
  orders: [],
};

test.each(["thanks-day", "wonderfulday"])("開催日がない固定キャンペーンは追加できない %s", (id) => {
  const template = campaignTemplates.find((t) => t.id === id);
  if (!template) throw new Error("missing template");
  expect(defaultInput(plan, template, plan.period.start)).toBeUndefined();
  const month = { ...plan, period: { start: "2026-10-01", end: "2026-10-31" } };
  expect(defaultInput(month, template, month.period.start)).toBeDefined();
});

test.each([
  ["thanks-day", "2026-10-18"],
  ["wonderfulday", "2026-11-01"],
])("開催日を含む期間の端でも追加でき、重複は追加できない %s", (id, date) => {
  const template = campaignTemplates.find((t) => t.id === id);
  if (!template) throw new Error("missing template");
  for (const period of [
    { start: date, end: date },
    { start: "2026-10-17", end: date },
  ]) {
    const target = { ...plan, period };
    expect(defaultInput(target, template, date)).toBeDefined();
    const benefit = instantiateCampaign(template, { id: template.benefit.id });
    expect(defaultInput({ ...target, benefits: [benefit] }, template, date)).toBeUndefined();
  }
});
