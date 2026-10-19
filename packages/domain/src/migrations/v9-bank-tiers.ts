import type { Migration } from "./runner";

const BANK_CARD_ID = "1933c19c-0aa3-4052-8d5e-c0d07859a0a9";
const BANK_SALARY_ID = "3a7c47bd-3404-4dcb-9569-54989e63f077";
const GROUP = "rakuten-bank";

/** The +0.3 tier as the master defined it at version 9, added off. */
const bankCard = {
  id: BANK_CARD_ID,
  kind: "rate-bonus",
  category: "spu",
  label: "楽天銀行（楽天カード引落）",
  imagePath: "/img/spu/service_bank.webp",
  enabled: false,
  amountBasis: "tax-excluded",
  capScope: "month",
  conditions: { channels: ["rakuten-ichiba", "rakuten-books", "rakuten-kobo"] },
  exclusiveGroup: GROUP,
  params: { rate: 0.3, cap: 1000, roundingUnit: "item" },
};

/**
 * Splits the 楽天銀行 benefit saved before version 9 into its two tiers. The saved one keeps its id,
 * its +0.5 rate and its on/off as the salary tier, so saved points do not change; the +0.3 tier is
 * added off just before it, in the same exclusive group.
 */
const splitBank =
  (key: "benefits" | "spuBenefits") =>
  (row: unknown): unknown => {
    const record = row as Record<string, unknown>;
    const benefits = record[key];
    if (!Array.isArray(benefits)) return row;
    if (benefits.some((benefit: { id?: unknown }) => benefit.id === BANK_CARD_ID)) return row;
    return {
      ...record,
      [key]: benefits.flatMap((benefit: { id?: unknown }) =>
        benefit.id === BANK_SALARY_ID
          ? [
              structuredClone(bankCard),
              { ...benefit, label: "楽天銀行（給与受取）", exclusiveGroup: GROUP },
            ]
          : [benefit],
      ),
    };
  };

export const bankTiersMigration: Migration = {
  to: 9,
  stores: { plans: splitBank("benefits"), profile: splitBank("spuBenefits") },
};
