import { largestRemainder } from "../allocation/largest-remainder";
import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import { benefitKinds, pointsFor, type EligibleItem } from "../benefit-kinds";
import { channels } from "../channels";
import { matchesConditions } from "../conditions/matches";
import type { Benefit } from "../model/benefit";
import type { ChannelId, OrderTag, ShopTag } from "../model/common";
import type { LineItem } from "../model/order";
import { type Plan, planAccountId } from "../model/plan";
import type { Shop } from "../model/shop";
import { capGroupKey, resolveGroupCap } from "./cap-groups";
import { shopAroundOutlook, type ShopAroundOutlook } from "./outlook";
import { POINT_GROUPS, pointGroupOf, type PointGroup } from "./point-group";
import { countShops } from "./shop-count";
import type {
  BenefitTotal,
  BreakdownRow,
  CalculationResult,
  CapGroupUsage,
  CalculationWarning,
  HeldEstimate,
} from "./types";

type OrderContext = {
  orderId: string;
  shopId: string;
  channel: ChannelId | null;
  shopTags: ShopTag[] | null;
  date: string;
  orderTaxIncluded: number;
  orderTags: OrderTag[];
  lineItems: LineItem[];
};

/** One eligible line item of one benefit in one plan, carried through the cap groups. */
type BenefitItem = {
  planId: string;
  lineItemId: string;
  /** The order date: earlier orders get a shared cap first. */
  date: string;
  groupKey: string;
  raw: number;
  points: number;
};

type BenefitEntry = { benefit: Benefit; items: BenefitItem[]; receivingBase: number };

type PlanPhase = {
  plan: Plan;
  orders: OrderContext[];
  shopCount: number;
  warnings: CalculationWarning[];
  entries: BenefitEntry[];
};

type CapGroup = {
  accountId: string;
  members: BenefitItem[];
  caps: (number | undefined)[];
  capReached: boolean;
  mismatch: boolean;
};

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byLineItemId = (a: { lineItemId: string }, b: { lineItemId: string }) =>
  compareIds(a.lineItemId, b.lineItemId);
const byPlanThenLineItem = (a: BenefitItem, b: BenefitItem) =>
  compareIds(a.planId, b.planId) || byLineItemId(a, b);

function rawPointsOf(
  benefit: Benefit,
  items: EligibleItem[],
  shopCount: number,
): Map<string, number> {
  switch (benefit.kind) {
    case "rate-bonus":
      return benefitKinds["rate-bonus"].rawPoints({ params: benefit.params, items, shopCount });
    case "shop-around":
      return benefitKinds["shop-around"].rawPoints({ params: benefit.params, items, shopCount });
  }
}

function targetAmount(benefit: Benefit, item: LineItem): number {
  return benefit.amountBasis === "tax-included" ? taxIncludedTarget(item) : taxExcludedTarget(item);
}

function eligibleItems(
  benefit: Benefit,
  orders: OrderContext[],
): (EligibleItem & { orderDate: string })[] {
  const onlyReceiving = benefitKinds[benefit.kind].onlyReceivingChannels;
  const items: (EligibleItem & { orderDate: string })[] = [];
  for (const order of orders) {
    if (onlyReceiving && (order.channel === null || !channels[order.channel].receivesShopAround)) {
      continue;
    }
    if (!matchesConditions(benefit.conditions, order)) continue;
    for (const item of order.lineItems) {
      items.push({
        lineItemId: item.id,
        orderId: order.orderId,
        amount: targetAmount(benefit, item),
        orderDate: order.date,
      });
    }
  }
  return items.sort(byLineItemId);
}

/** Contexts of the orders that are not held. Held orders are left out of the whole calculation. */
function orderContexts(plan: Plan, shops: Map<string, Shop>, warnings: CalculationWarning[]) {
  const active = plan.orders.filter((order) => !order.onHold);
  return active.map((order): OrderContext => {
    const shop = shops.get(order.shopId);
    if (!shop) warnings.push({ type: "unknown-shop", orderId: order.id });
    if (order.date < plan.period.start || order.date > plan.period.end) {
      warnings.push({ type: "order-outside-period", orderId: order.id });
    }
    return {
      orderId: order.id,
      shopId: order.shopId,
      channel: shop?.channel ?? null,
      shopTags: shop?.tags ?? null,
      date: order.date,
      orderTaxIncluded: order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0),
      orderTags: order.tags,
      lineItems: order.lineItems,
    };
  });
}

function planPhase(plan: Plan, shops: Shop[], shopsById: Map<string, Shop>): PlanPhase {
  const warnings: CalculationWarning[] = [];
  const orders = orderContexts(plan, shopsById, warnings);
  const shopCount = countShops(plan.orders, shops, plan.period);
  const groupOwner = { id: plan.id, accountId: planAccountId(plan) };
  const entries = plan.benefits
    .filter((benefit) => benefit.enabled)
    .map((benefit): BenefitEntry => {
      const eligible = eligibleItems(benefit, orders);
      const raw = rawPointsOf(benefit, eligible, shopCount);
      const items = eligible.map(({ lineItemId, orderDate }) => {
        const points = raw.get(lineItemId) ?? 0;
        const groupKey = capGroupKey(groupOwner, benefit, orderDate);
        return { planId: plan.id, lineItemId, date: orderDate, groupKey, raw: points, points };
      });
      const receivingBase = eligible.reduce((sum, item) => sum + item.amount, 0);
      return { benefit, items, receivingBase };
    });
  return { plan, orders, shopCount, warnings, entries };
}

function collectGroups(phases: PlanPhase[]): Map<string, CapGroup> {
  const groups = new Map<string, CapGroup>();
  for (const { plan, entries } of phases) {
    for (const { benefit, items } of entries) {
      const keysOfEntry = new Set<string>();
      for (const item of items) {
        let group = groups.get(item.groupKey);
        if (!group) {
          group = {
            accountId: planAccountId(plan),
            members: [],
            caps: [],
            capReached: false,
            mismatch: false,
          };
          groups.set(item.groupKey, group);
        }
        group.members.push(item);
        if (!keysOfEntry.has(item.groupKey)) {
          keysOfEntry.add(item.groupKey);
          group.caps.push(benefit.params.cap);
        }
      }
    }
  }
  return groups;
}

/**
 * Caps each group and writes the allocated points back onto its members. The earlier orders get
 * the cap first, so adding a later plan never takes points from an earlier one; the members of
 * one day split what is left by their raw points.
 */
function applyCap(group: CapGroup): void {
  const { cap, mismatch } = resolveGroupCap(group.caps);
  const rawSum = group.members.reduce((sum, member) => sum + member.raw, 0);
  group.mismatch = mismatch;
  group.capReached = cap !== undefined && rawSum >= cap;
  if (cap === undefined || rawSum <= cap) return;
  const days = new Map<string, BenefitItem[]>();
  const sorted = [...group.members].sort(
    (a, b) => compareIds(a.date, b.date) || byPlanThenLineItem(a, b),
  );
  for (const member of sorted) {
    const day = days.get(member.date);
    if (day) day.push(member);
    else days.set(member.date, [member]);
  }
  let left = cap;
  for (const members of days.values()) {
    const raws = members.map((member) => member.raw);
    const share = Math.min(
      left,
      raws.reduce((sum, points) => sum + points, 0),
    );
    const allocated = largestRemainder(share, raws);
    members.forEach((member, index) => {
      member.points = allocated[index] ?? 0;
    });
    left -= share;
  }
}

function shopRateRows(orders: OrderContext[]): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const items = orders
    .flatMap((order) => order.lineItems.map((item) => ({ orderId: order.orderId, item })))
    .sort((a, b) => compareIds(a.item.id, b.item.id));
  for (const { orderId, item } of items) {
    if (item.shopPointRate === undefined || item.shopPointRate - 1 <= 0) continue;
    const eligible = { lineItemId: item.id, orderId, amount: taxExcludedTarget(item) };
    const points = pointsFor([eligible], item.shopPointRate - 1, "item").get(item.id) ?? 0;
    rows.push({ lineItemId: item.id, source: "shop-rate", points });
  }
  return rows;
}

/**
 * Cap left for this entry in its cap group: the group's resolved cap minus the raw points of every
 * other member (other plans, or other benefits sharing the key). For month- or day-scoped caps the
 * group of the entry's first item is used (the plan period start when it has no items).
 */
function remainingGroupCap(
  phase: PlanPhase,
  entry: BenefitEntry,
  groups: Map<string, CapGroup>,
): number | undefined {
  const own = entry.benefit.params.cap;
  const owner = { id: phase.plan.id, accountId: planAccountId(phase.plan) };
  const key =
    entry.items[0]?.groupKey ?? capGroupKey(owner, entry.benefit, phase.plan.period.start);
  const group = groups.get(key);
  if (!group) return own;
  const mine = new Set(entry.items);
  const caps = mine.size === 0 ? [...group.caps, own] : group.caps;
  const { cap } = resolveGroupCap(caps);
  if (cap === undefined) return undefined;
  const othersRaw = group.members
    .filter((member) => !mine.has(member))
    .reduce((sum, member) => sum + member.raw, 0);
  return Math.max(0, cap - othersRaw);
}

function outlookOf(phase: PlanPhase, groups: Map<string, CapGroup>): ShopAroundOutlook | null {
  const entry = phase.entries.find(({ benefit }) => benefit.kind === "shop-around");
  if (!entry || entry.benefit.kind !== "shop-around") return null;
  return shopAroundOutlook({
    benefitId: entry.benefit.id,
    tiers: entry.benefit.params.tiers,
    cap: remainingGroupCap(phase, entry, groups),
    amountBasis: entry.benefit.amountBasis,
    shopCount: phase.shopCount,
    receivingBase: entry.receivingBase,
  });
}

function usageOf(group: CapGroup): CapGroupUsage {
  const points: Record<string, number> = {};
  for (const member of group.members) {
    points[member.planId] = (points[member.planId] ?? 0) + member.points;
  }
  const raw = group.members.reduce((sum, member) => sum + member.raw, 0);
  return { cap: resolveGroupCap(group.caps).cap, raw, points };
}

/**
 * The usage of every group of `accountId`. A plain record, not a `Map`, so that structural
 * comparisons of results see its contents.
 */
function capUsageOf(
  groups: Map<string, CapGroup>,
  accountId: string,
): Record<string, CapGroupUsage> {
  const usage: Record<string, CapGroupUsage> = {};
  for (const [key, group] of groups) {
    if (group.accountId === accountId) usage[key] = usageOf(group);
  }
  return usage;
}

type CoreResult = Omit<CalculationResult, "heldEstimates">;

function assemble(phase: PlanPhase, groups: Map<string, CapGroup>): CoreResult {
  const breakdown: BreakdownRow[] = [];
  const benefitTotals: BenefitTotal[] = [];
  const mismatchKeys = new Set<string>();
  const groupTotals = Object.fromEntries(POINT_GROUPS.map((group) => [group, 0])) as Record<
    PointGroup,
    number
  >;
  for (const { benefit, items } of phase.entries) {
    const pointGroup = pointGroupOf(benefit);
    let rawPoints = 0;
    let cappedPoints = 0;
    let capReached = false;
    for (const item of items) {
      const group = groups.get(item.groupKey);
      rawPoints += item.raw;
      cappedPoints += item.points;
      capReached ||= group?.capReached ?? false;
      if (group?.mismatch) mismatchKeys.add(item.groupKey);
      breakdown.push({ lineItemId: item.lineItemId, source: benefit.id, points: item.points });
      groupTotals[pointGroup] += item.points;
    }
    benefitTotals.push({ benefitId: benefit.id, rawPoints, cappedPoints, capReached });
  }
  const shopRate = shopRateRows(phase.orders);
  breakdown.push(...shopRate);
  for (const row of shopRate) groupTotals[pointGroupOf("shop-rate")] += row.points;

  const nonZero = breakdown.filter((row) => row.points !== 0);
  const mismatchWarnings = [...mismatchKeys].map((groupKey): CalculationWarning => ({
    type: "shared-cap-mismatch",
    groupKey,
  }));
  return {
    breakdown: nonZero,
    benefitTotals,
    shopCount: phase.shopCount,
    total: nonZero.reduce((sum, row) => sum + row.points, 0),
    warnings: [...phase.warnings, ...mismatchWarnings],
    groupTotals,
    shopAroundOutlook: outlookOf(phase, groups),
    capUsage: capUsageOf(groups, planAccountId(phase.plan)),
  };
}

function calculateCore(plans: Plan[], shops: Shop[]): Map<string, CoreResult> {
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const phases = plans.map((plan) => planPhase(plan, shops, shopsById));
  const groups = collectGroups(phases);
  for (const group of groups.values()) applyCap(group);
  return new Map(phases.map((phase) => [phase.plan.id, assemble(phase, groups)]));
}

const sumOfTotals = (results: Map<string, CoreResult>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

/**
 * Recalculates every plan with only `orderId` of `plan` unheld, and returns the increase of the
 * sum of all plans' totals. Summing over all plans keeps points that merely move between plans
 * sharing a cap group out of the estimate.
 */
function heldEstimate(plans: Plan[], shops: Shop[], plan: Plan, orderId: string, before: number) {
  const unheld = plans.map((other) =>
    other.id !== plan.id
      ? other
      : {
          ...other,
          orders: other.orders.map((order) =>
            order.id === orderId ? { ...order, onHold: false } : order,
          ),
        },
  );
  return sumOfTotals(calculateCore(unheld, shops)) - before;
}

/** Calculates every plan at once, because caps can be shared across plans. Keyed by plan ID. */
export function calculateAll(plans: Plan[], shops: Shop[]): Map<string, CalculationResult> {
  const core = calculateCore(plans, shops);
  const before = sumOfTotals(core);
  return new Map(
    plans.flatMap((plan) => {
      const result = core.get(plan.id);
      if (!result) return [];
      const heldEstimates = plan.orders
        .filter((order) => order.onHold)
        .map((order): HeldEstimate => ({
          orderId: order.id,
          points: heldEstimate(plans, shops, plan, order.id, before),
        }));
      return [[plan.id, { ...result, heldEstimates }] as const];
    }),
  );
}

export function calculate(plan: Plan, shops: Shop[]): CalculationResult {
  const result = calculateAll([plan], shops).get(plan.id);
  if (!result) throw new Error(`no calculation result for plan ${plan.id}`);
  return result;
}
