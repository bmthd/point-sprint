import type { Benefit } from "../model/benefit";
import type { Plan } from "../model/plan";

/**
 * Returns the benefits with the benefit's `enabled` flipped. Enabling a benefit that has an
 * `exclusiveGroup` disables the other benefits in the same group; disabling touches nothing else.
 * The given list is not changed.
 */
export function toggleBenefits(benefits: Benefit[], benefitId: string): Benefit[] {
  const target = benefits.find((benefit) => benefit.id === benefitId);
  if (!target) throw new Error(`benefit ${benefitId} is not in the list`);
  const enabled = !target.enabled;
  const next = structuredClone(benefits);
  for (const benefit of next) {
    if (benefit.id === benefitId) {
      benefit.enabled = enabled;
    } else if (
      enabled &&
      target.exclusiveGroup !== undefined &&
      benefit.exclusiveGroup === target.exclusiveGroup
    ) {
      benefit.enabled = false;
    }
  }
  return next;
}

/** `toggleBenefits` on a plan's benefits. The given plan is not changed. */
export function toggleBenefit(plan: Plan, benefitId: string): Plan {
  if (!plan.benefits.some((benefit) => benefit.id === benefitId)) {
    throw new Error(`benefit ${benefitId} is not in plan ${plan.id}`);
  }
  return { ...structuredClone(plan), benefits: toggleBenefits(plan.benefits, benefitId) };
}
