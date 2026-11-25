import type { Migration } from "./runner.ts";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A 10-letter id made from the plan's id, so that every device that migrates the same plan adds
 * the same benefit.
 */
function idFrom(planId: string): string {
  const hash = (seed: number) => {
    let h = seed;
    for (const char of planId) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
    return (h % 36 ** 5).toString(36).padStart(5, "0");
  };
  return `${hash(2166136261)}${hash(374761393)}`;
}

/**
 * Adds the ラクマ購入 +1倍 (`master/rakuma.ts` as it is at this version), off, to a plan attached to
 * an official event that lacks one.
 */
const withRakuma = (row: unknown): unknown => {
  if (!isRow(row) || typeof row.id !== "string" || typeof row.officialEventId !== "string") {
    return row;
  }
  const { period, benefits } = row;
  if (!isRow(period) || typeof period.start !== "string" || typeof period.end !== "string") {
    return row;
  }
  if (!Array.isArray(benefits)) return row;
  const hasRakuma = benefits.some(
    (benefit) =>
      isRow(benefit) &&
      typeof benefit.sharedKey === "string" &&
      benefit.sharedKey.startsWith("rakuma:"),
  );
  if (hasRakuma) return row;
  const rakuma = {
    id: idFrom(row.id),
    kind: "rate-bonus",
    category: "campaign",
    label: "ラクマ購入",
    imagePath: "/img/spu/service_rakuma.webp",
    enabled: false,
    amountBasis: "tax-excluded",
    capScope: "campaign",
    sharedKey: `rakuma:${row.officialEventId}`,
    conditions: {
      channels: ["rakuten-ichiba", "rakuten-books", "rakuten-kobo"],
      dateRule: { type: "range", start: period.start, end: period.end },
      minShopAmount: 1000,
    },
    params: { rate: 1, cap: 500, roundingUnit: "item" },
  };
  return { ...row, benefits: [...benefits, rakuma] };
};

export const rakumaMigration: Migration = {
  to: 16,
  stores: { plans: withRakuma },
};
