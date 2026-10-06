import type { LineItem } from "../model/order";

export function taxIncludedTarget(item: LineItem): number {
  return item.unitPrice * item.quantity - item.discount;
}

/** Tax-exempt items (`taxRate: 0`) return the tax-included target unchanged. */
export function taxExcludedTarget(item: LineItem): number {
  const incl = taxIncludedTarget(item);
  if (item.taxRate === 0) return incl;
  const pct = Math.round(item.taxRate * 100);
  return incl - Math.floor((incl * pct) / (100 + pct));
}
