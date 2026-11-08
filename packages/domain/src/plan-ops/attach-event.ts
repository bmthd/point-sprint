import { campaignTemplates } from "#/master/campaigns.ts";
import { instantiateCampaign } from "#/master/instantiate.ts";
import { comesWithPlan } from "#/model/campaign-template.ts";
import type { Id } from "#/model/common.ts";
import type { OfficialEvent } from "#/model/official-event.ts";
import type { Plan } from "#/model/plan.ts";

/**
 * Returns the plan attached to an official event, as `createPlan` would have made it from the
 * event: the event's id, period and benefits. The fixed campaigns (days ending in 5 or 0) stay with
 * their ids and whether the user entered them; one the plan lacks is added disabled with an id from
 * `newId`. The other benefits are replaced, and the orders stay, even those now outside the period.
 * The given plan and event are not changed.
 */
export function attachToEvent(plan: Plan, event: OfficialEvent, newId: () => Id): Plan {
  const fixedCampaigns = campaignTemplates.filter(comesWithPlan).map((template) => {
    const kept = plan.benefits.find((benefit) => benefit.sharedKey === template.benefit.sharedKey);
    return kept ? structuredClone(kept) : instantiateCampaign(template, { id: newId() });
  });
  return {
    ...structuredClone(plan),
    officialEventId: event.id,
    period: { ...event.period },
    benefits: [...structuredClone(event.benefits), ...fixedCampaigns],
  };
}
