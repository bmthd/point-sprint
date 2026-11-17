import type { Plan } from "#/model/plan.ts";

/** Holds the plan, or releases it; a plan that is not held does not carry `onHold`. */
export function togglePlanHold(plan: Plan): Plan {
  const { onHold, ...rest } = plan;
  return onHold ? rest : { ...rest, onHold: true };
}
