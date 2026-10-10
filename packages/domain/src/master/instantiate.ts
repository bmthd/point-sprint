import type { Benefit } from "../model/benefit";
import type { CampaignTemplate } from "../model/campaign-template";
import type { Id, IsoDate, Period } from "../model/common";
import type { Plan } from "../model/plan";
import { campaignTemplates } from "./campaigns";

/** What a campaign is made with, beside its id. */
export type CampaignInput = Omit<Input, "id">;

type Input = {
  id: Id;
  dates?: IsoDate[];
  rate?: number;
  period?: Period;
  cap?: number;
  minOrderAmount?: number;
  label?: string;
};

/** Builds a plan benefit from a campaign template. Never mutates the template. */
export function instantiateCampaign(template: CampaignTemplate, input: Input): Benefit {
  const benefit = structuredClone(template.benefit);
  benefit.id = input.id;
  const conditions = { ...benefit.conditions };

  if (template.occurrence === "user-dates") {
    if (!input.dates || input.dates.length === 0) {
      throw new Error(`campaign "${template.id}" requires dates (at least one)`);
    }
    conditions.dateRule = { type: "dates", dates: [...input.dates] };
    if (input.rate !== undefined && benefit.kind === "rate-bonus") {
      benefit.params.rate = input.rate;
      if (template.id === "sports-win" && input.rate === 2) {
        benefit.imagePath = "/img/campaign/sports-w.webp";
      }
    }
    // The user entered the days they took part in, so the benefit starts enabled.
    benefit.enabled = true;
  } else if (template.occurrence === "user-period") {
    if (!input.period) throw new Error(`campaign "${template.id}" requires a period`);
    conditions.dateRule = { type: "range", start: input.period.start, end: input.period.end };
    if (input.rate !== undefined && benefit.kind === "rate-bonus") {
      benefit.params.rate = input.rate;
    }
    const sharedKey = periodSharedKey(template, input.period);
    if (sharedKey === undefined) delete benefit.sharedKey;
    else benefit.sharedKey = sharedKey;
    // The user entered the period they took part in, so the benefit starts enabled.
    benefit.enabled = true;
  }
  if (input.cap !== undefined) benefit.params.cap = input.cap;
  if (input.minOrderAmount !== undefined) conditions.minOrderAmount = input.minOrderAmount;
  if (input.label !== undefined) benefit.label = input.label;
  benefit.conditions = conditions;
  return benefit;
}

function periodSharedKey(template: CampaignTemplate, period: Period): string | undefined {
  const key = template.benefit.sharedKey;
  return key === undefined ? undefined : `${key}:${period.start}`;
}

/**
 * Whether the plan already has a benefit made from this template for the same occurrence.
 * Templates without a `sharedKey` can be added any number of times, so they always return false.
 */
export function hasCampaignOccurrence(
  plan: Plan,
  template: CampaignTemplate,
  input: { dates?: IsoDate[]; period?: Period },
): boolean {
  const key = template.benefit.sharedKey;
  if (key === undefined) return false;
  switch (template.occurrence) {
    case "fixed":
      return plan.benefits.some((benefit) => benefit.sharedKey === key);
    case "user-period": {
      if (!input.period) return false;
      const periodKey = periodSharedKey(template, input.period);
      return plan.benefits.some((benefit) => benefit.sharedKey === periodKey);
    }
    case "user-dates": {
      const dates = input.dates ?? [];
      return plan.benefits.some((benefit) => {
        const rule = benefit.conditions.dateRule;
        return (
          benefit.sharedKey === key &&
          rule?.type === "dates" &&
          rule.dates.some((date) => dates.includes(date))
        );
      });
    }
  }
}

/**
 * The template a campaign the user added was made from: the one whose `sharedKey` it carries, or
 * 自由な倍率 for a rate without one. `undefined` for anything else.
 */
export function templateOfCampaign(benefit: Benefit): CampaignTemplate | undefined {
  const key = benefit.sharedKey;
  if (key === undefined) {
    return benefit.kind === "rate-bonus"
      ? campaignTemplates.find((template) => template.id === "custom-rate")
      : undefined;
  }
  return campaignTemplates.find((template) => {
    const templateKey = template.benefit.sharedKey;
    return (
      template.occurrence !== "fixed" &&
      templateKey !== undefined &&
      (key === templateKey || key.startsWith(`${templateKey}:`))
    );
  });
}

/** What a campaign was made with, so that it can be made again with some of it changed. */
export function campaignInputOf(benefit: Benefit): CampaignInput {
  const rule = benefit.conditions.dateRule;
  return {
    ...(rule?.type === "dates" ? { dates: [...rule.dates] } : {}),
    ...(rule?.type === "range" ? { period: { start: rule.start, end: rule.end } } : {}),
    ...(benefit.kind === "rate-bonus" ? { rate: benefit.params.rate } : {}),
    ...(benefit.params.cap === undefined ? {} : { cap: benefit.params.cap }),
    ...(benefit.conditions.minOrderAmount === undefined
      ? {}
      : { minOrderAmount: benefit.conditions.minOrderAmount }),
    label: benefit.label,
  };
}

/**
 * The campaign made again from `template` with `change` over what it was made with. It keeps its
 * id and whether it is on.
 */
export function editCampaign(
  template: CampaignTemplate,
  benefit: Benefit,
  change: CampaignInput,
): Benefit {
  const input = { ...campaignInputOf(benefit), ...change, id: benefit.id };
  return { ...instantiateCampaign(template, input), enabled: benefit.enabled };
}
