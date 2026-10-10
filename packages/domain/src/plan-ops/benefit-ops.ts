import type { Benefit } from "../model/benefit";
import type { Plan } from "../model/plan";

/**
 * Returns the benefits with the benefit's `enabled` flipped. The given list is not changed.
 *
 * - Enabling a benefit that has an `exclusiveGroup` disables the other benefits in the same group.
 * - A benefit that others `require` is on exactly when one of them is on. Enabling a benefit enables
 *   the one it requires, and disabling the last one on disables it. Enabling a required benefit
 *   with none of its dependents on enables the first dependent; disabling it disables them all.
 */
export function toggleBenefits(benefits: Benefit[], benefitId: string): Benefit[] {
  const next = structuredClone(benefits);
  const target = next.find((benefit) => benefit.id === benefitId);
  if (!target) throw new Error(`benefit ${benefitId} is not in the list`);
  const enabled = !target.enabled;
  setEnabled(next, target, enabled);

  const required = next.find((benefit) => benefit.id === target.requires);
  if (enabled && required) {
    required.enabled = true;
  } else if (required) {
    required.enabled = next.some((benefit) => benefit.requires === required.id && benefit.enabled);
  }

  const dependents = next.filter((benefit) => benefit.requires === target.id);
  const [first] = dependents;
  if (!enabled) {
    for (const dependent of dependents) dependent.enabled = false;
  } else if (first && !dependents.some((dependent) => dependent.enabled)) {
    setEnabled(next, first, true);
  }
  return next;
}

function setEnabled(benefits: Benefit[], target: Benefit, enabled: boolean) {
  target.enabled = enabled;
  if (!enabled || target.exclusiveGroup === undefined) return;
  for (const benefit of benefits) {
    if (benefit !== target && benefit.exclusiveGroup === target.exclusiveGroup) {
      benefit.enabled = false;
    }
  }
}

/** `toggleBenefits` on a plan's benefits. The given plan is not changed. */
export function toggleBenefit(plan: Plan, benefitId: string): Plan {
  if (!plan.benefits.some((benefit) => benefit.id === benefitId)) {
    throw new Error(`benefit ${benefitId} is not in plan ${plan.id}`);
  }
  return { ...structuredClone(plan), benefits: toggleBenefits(plan.benefits, benefitId) };
}
