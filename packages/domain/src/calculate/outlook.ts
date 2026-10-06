import { tierRate, type ShopAroundTier } from "../benefit-kinds/shop-around";
import type { Benefit } from "../model/benefit";

export type ShopAroundOutlookRow = {
  shops: number;
  rate: number;
  /**
   * Target amount that can still be bought before the cap is reached, in the benefit's
   * `amountBasis` (tax-excluded for every preset).
   */
  remainingTaxExcluded: number | null;
  /** Tax-included estimate at 10%; equal to `remainingTaxExcluded` for a tax-included basis. */
  remainingTaxIncludedApprox: number | null;
};

export type ShopAroundOutlook = {
  benefitId: string;
  shopCount: number;
  /** Rate of the tier reached by the current shop count. */
  currentRate: number;
  /** Sum of the target amounts (by the benefit's `amountBasis`) of the items that receive the benefit. */
  receivingBase: number;
  /**
   * Points this plan can still receive from the benefit's cap group: the group's cap minus the raw
   * points of every other member of the group (other plans, or other benefits sharing the key).
   * `null` when the group has no cap.
   */
  cap: number | null;
  rows: ShopAroundOutlookRow[];
  /** What one more shop adds. `null` when one more shop does not change the rate. */
  nextShop: { rateDelta: number; pointsGain: number } | null;
};

const toBp = (rate: number) => Math.round(rate * 100);
const pointsAt = (amount: number, rate: number) => Math.floor((amount * toBp(rate)) / 10000);

function remainingUntilCap(cap: number | null, rate: number, receivingBase: number): number | null {
  const rateBp = toBp(rate);
  if (cap === null || rateBp === 0) return null;
  // ceil(cap × 100 / rate) with the rate in hundredths: ceil(cap × 10000 / rateBp).
  return Math.max(0, Math.ceil((cap * 10000) / rateBp) - receivingBase);
}

/**
 * Tax-included equivalent of a remaining amount, assuming the 10% rate. When the benefit already
 * counts tax-included amounts, the remaining amount is tax-included and is returned unchanged.
 */
function taxIncludedApprox(
  remaining: number | null,
  amountBasis: Benefit["amountBasis"],
): number | null {
  if (remaining === null || amountBasis === "tax-included") return remaining;
  return Math.floor((remaining * 11) / 10);
}

/** Outlook of one shop-around benefit for the shop counts from now up to the top tier. */
export function shopAroundOutlook(input: {
  benefitId: string;
  tiers: ShopAroundTier[];
  /** Effective cap for this plan (see `ShopAroundOutlook.cap`). */
  cap: number | undefined;
  amountBasis: Benefit["amountBasis"];
  shopCount: number;
  receivingBase: number;
}): ShopAroundOutlook {
  const { benefitId, tiers, amountBasis, shopCount, receivingBase } = input;
  const cap = input.cap ?? null;
  const currentRate = tierRate(tiers, shopCount);
  const topShops = Math.max(...tiers.map((tier) => tier.minShops));
  // Beyond the top tier the rate no longer changes, so the rows stop at the top tier.
  const firstShops = Math.min(Math.max(shopCount, 1), topShops);

  const rows: ShopAroundOutlookRow[] = [];
  for (let shops = firstShops; shops <= topShops; shops++) {
    const rate = tierRate(tiers, shops);
    const remainingTaxExcluded = remainingUntilCap(cap, rate, receivingBase);
    rows.push({
      shops,
      rate,
      remainingTaxExcluded,
      remainingTaxIncludedApprox: taxIncludedApprox(remainingTaxExcluded, amountBasis),
    });
  }

  // 「あと1店舗で」: the rate at one more shop, not at the next tier.
  const nextRate = tierRate(tiers, shopCount + 1);
  const deltaBp = toBp(nextRate) - toBp(currentRate);
  const capped = (points: number) => (cap === null ? points : Math.min(cap, points));
  const nextShop =
    deltaBp === 0
      ? null
      : {
          rateDelta: deltaBp / 100,
          pointsGain:
            capped(pointsAt(receivingBase, nextRate)) -
            capped(pointsAt(receivingBase, currentRate)),
        };

  return { benefitId, shopCount, currentRate, receivingBase, cap, rows, nextShop };
}
