import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import type { Benefit } from "../model/benefit";
import type { LineItem } from "../model/order";

export type TaxRate = LineItem["taxRate"];

const toBp = (rate: number) => Math.round(rate * 100);

/** Points one item at a tax-included `price` earns at +`rate`倍, rounded down like the calculation. */
export function pointsForPrice(
  price: number,
  taxRate: TaxRate,
  rate: number,
  amountBasis: Benefit["amountBasis"],
): number {
  const item: LineItem = { id: "", name: "", unitPrice: price, quantity: 1, taxRate, discount: 0 };
  const target = amountBasis === "tax-included" ? taxIncludedTarget(item) : taxExcludedTarget(item);
  return Math.floor((target * toBp(rate)) / 10000);
}

/**
 * The smallest tax-included price of one item that earns `points` at +`rate`倍. `null` when the
 * rate is 0, so no price earns anything.
 */
export function priceToFill(
  points: number,
  taxRate: TaxRate,
  rate: number,
  amountBasis: Benefit["amountBasis"],
): number | null {
  if (points <= 0) return 0;
  const rateBp = toBp(rate);
  if (rateBp <= 0) return null;
  // Twice the tax-excluded amount is more than enough at any tax rate up to 10%.
  let low = 0;
  let high = 2 * Math.ceil((points * 10000) / rateBp) + 2;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (pointsForPrice(mid, taxRate, rate, amountBasis) >= points) high = mid;
    else low = mid + 1;
  }
  return low;
}
