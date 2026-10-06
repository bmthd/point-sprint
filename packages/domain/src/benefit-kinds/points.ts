import { largestRemainder } from "../allocation/largest-remainder";
import type { EligibleItem, RoundingUnit } from "./types";

function floorPoints(amount: number, rate: number): number {
  const rateBp = Math.round(rate * 100);
  return Math.floor((amount * rateBp) / 10000);
}

export function pointsFor(
  items: EligibleItem[],
  rate: number,
  unit: RoundingUnit,
): Map<string, number> {
  const result = new Map<string, number>();
  if (unit === "item") {
    for (const item of items) result.set(item.lineItemId, floorPoints(item.amount, rate));
    return result;
  }
  const orders = new Map<string, EligibleItem[]>();
  for (const item of items) {
    const group = orders.get(item.orderId);
    if (group) group.push(item);
    else orders.set(item.orderId, [item]);
  }
  for (const group of orders.values()) {
    const total = floorPoints(
      group.reduce((sum, item) => sum + item.amount, 0),
      rate,
    );
    const shares = largestRemainder(
      total,
      group.map((item) => item.amount),
    );
    group.forEach((item, index) => result.set(item.lineItemId, shares[index] ?? 0));
  }
  return result;
}
