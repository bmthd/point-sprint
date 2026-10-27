import { comesWithPlan } from "../model/campaign-template";
import type { Id } from "../model/common";
import type { OfficialEvent } from "../model/official-event";
import type { Plan } from "../model/plan";
import { campaignTemplates } from "./campaigns";
import { instantiateCampaign } from "./instantiate";

const tokyoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function createPlan(input: {
  id: string;
  name: string;
  event?: OfficialEvent;
  now: string;
  newId: () => Id;
}): Plan {
  const { id, name, event, now, newId } = input;
  // Fixed campaigns (days ending in 5 or 0) are judged by their date rule, so every plan gets them.
  // They stay disabled until the user says they entered.
  const fixedCampaigns = campaignTemplates
    .filter(comesWithPlan)
    .map((template) => instantiateCampaign(template, { id: newId() }));
  const today = tokyoDate.format(new Date(now));
  return {
    id,
    name,
    ...(event ? { officialEventId: event.id } : {}),
    period: event ? { ...event.period } : { start: today, end: today },
    // The SPU is not the plan's: it is the account's for each month (`planWithSpu`).
    benefits: [...structuredClone(event?.benefits ?? []), ...fixedCampaigns],
    orders: [],
    updatedAt: now,
  };
}
