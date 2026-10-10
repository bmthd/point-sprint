import {
  type Benefit,
  copyOrder,
  moveOrder,
  type Order,
  type Plan,
  toggleBenefit,
} from "@workspaces/domain";
import { atom } from "jotai";
import { savePlanAtom } from "./mutations";

const replaceOrder = (plan: Plan, orderId: string, change: (order: Order) => Order): Plan => {
  if (!plan.orders.some((order) => order.id === orderId)) {
    throw new Error(`order ${orderId} is not in plan ${plan.id}`);
  }
  return {
    ...plan,
    orders: plan.orders.map((order) => (order.id === orderId ? change(order) : order)),
  };
};

export const addOrder = (plan: Plan, order: Order): Plan => ({
  ...plan,
  orders: [...plan.orders, order],
});

export const updateOrder = (plan: Plan, order: Order): Plan =>
  replaceOrder(plan, order.id, () => order);

export const removeOrder = (plan: Plan, orderId: string): Plan => ({
  ...plan,
  orders: plan.orders.filter((order) => order.id !== orderId),
});

export const clearOrders = (plan: Plan): Plan => ({ ...plan, orders: [] });

export const copyOrderInPlan = (
  plan: Plan,
  orderId: string,
  newId: () => string = () => crypto.randomUUID(),
): Plan => copyOrder(plan, orderId, newId);

/**
 * New ids that come out the same each time the returned function is called again, so a change
 * applied to the cache and then to the repository creates the same ids in both.
 */
function repeatableIds() {
  const ids: string[] = [];
  return () => {
    let index = 0;
    return () => {
      const id = ids[index] ?? crypto.randomUUID();
      ids[index++] = id;
      return id;
    };
  };
}

export const moveOrderInPlan = (plan: Plan, orderId: string, toIndex: number): Plan =>
  moveOrder(plan, orderId, toIndex);

export const toggleHold = (plan: Plan, orderId: string): Plan =>
  replaceOrder(plan, orderId, (order) => ({ ...order, onHold: !order.onHold }));

export const toggleBenefitInPlan = (plan: Plan, benefitId: string): Plan =>
  toggleBenefit(plan, benefitId);

export const addBenefit = (plan: Plan, benefit: Benefit): Plan => ({
  ...plan,
  benefits: [...plan.benefits, benefit],
});

export const addBenefits = (plan: Plan, benefits: Benefit[]): Plan => ({
  ...plan,
  benefits: [...plan.benefits, ...benefits],
});

export const removeBenefit = (plan: Plan, benefitId: string): Plan => ({
  ...plan,
  benefits: plan.benefits.filter((benefit) => benefit.id !== benefitId),
});

export const updateBenefit = (
  plan: Plan,
  benefitId: string,
  change: (benefit: Benefit) => Benefit,
): Plan => {
  if (!plan.benefits.some((benefit) => benefit.id === benefitId)) {
    throw new Error(`benefit ${benefitId} is not in plan ${plan.id}`);
  }
  return {
    ...plan,
    benefits: plan.benefits.map((benefit) =>
      benefit.id === benefitId ? change(benefit) : benefit,
    ),
  };
};

/**
 * A write-only atom that saves a change through `savePlanAtom`. `toChange` turns the arguments into
 * the change once per operation; the change is then applied to the plan as it is when the mutation
 * runs, not when the atom is set. Operations set one after another therefore compose: each sees the
 * ones before it, and one that fails is left out of the later ones' saves.
 */
function planOperationAtom<TArgs>(toChange: (args: TArgs) => (plan: Plan) => Plan) {
  return atom(null, (get, _set, { planId, ...args }: { planId: string } & TArgs) => {
    const change = toChange(args as unknown as TArgs);
    return get(savePlanAtom).mutateAsync({
      planId,
      change: (plan) => {
        if (!plan) throw new Error(`plan ${planId} does not exist`);
        return change(plan);
      },
    });
  });
}

export const addOrderAtom = planOperationAtom(
  ({ order }: { order: Order }) =>
    (plan) =>
      addOrder(plan, order),
);
export const updateOrderAtom = planOperationAtom(
  ({ order }: { order: Order }) =>
    (plan) =>
      updateOrder(plan, order),
);
export const removeOrderAtom = planOperationAtom(
  ({ orderId }: { orderId: string }) =>
    (plan) =>
      removeOrder(plan, orderId),
);
export const clearOrdersAtom = planOperationAtom<object>(() => clearOrders);
export const copyOrderAtom = planOperationAtom(({ orderId }: { orderId: string }) => {
  const newIds = repeatableIds();
  return (plan) => copyOrderInPlan(plan, orderId, newIds());
});
export const moveOrderAtom = planOperationAtom(
  ({ orderId, toIndex }: { orderId: string; toIndex: number }) =>
    (plan) =>
      moveOrderInPlan(plan, orderId, toIndex),
);
export const toggleHoldAtom = planOperationAtom(
  ({ orderId }: { orderId: string }) =>
    (plan) =>
      toggleHold(plan, orderId),
);
export const toggleBenefitAtom = planOperationAtom(
  ({ benefitId }: { benefitId: string }) =>
    (plan) =>
      toggleBenefitInPlan(plan, benefitId),
);
export const addBenefitAtom = planOperationAtom(
  ({ benefit }: { benefit: Benefit }) =>
    (plan) =>
      addBenefit(plan, benefit),
);
export const addBenefitsAtom = planOperationAtom(
  ({ benefits }: { benefits: Benefit[] }) =>
    (plan) =>
      addBenefits(plan, benefits),
);
export const removeBenefitAtom = planOperationAtom(
  ({ benefitId }: { benefitId: string }) =>
    (plan) =>
      removeBenefit(plan, benefitId),
);
/** `change` gets the benefit as it is when the change is applied, like the plan changes. */
export const updateBenefitAtom = planOperationAtom(
  ({ benefitId, change }: { benefitId: string; change: (benefit: Benefit) => Benefit }) =>
    (plan) =>
      updateBenefit(plan, benefitId, change),
);
