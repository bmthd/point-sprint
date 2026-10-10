import type { Migration } from "./runner";

/**
 * Moves the caps of 勝ったら倍 saved before version 3 from a day to an occurrence. Each was added
 * for one day, so it is one occurrence and its points do not change.
 */
const toOccurrence = (row: unknown): unknown => {
  const record = row as Record<string, unknown>;
  const benefits = record.benefits;
  if (!Array.isArray(benefits)) return row;
  return {
    ...record,
    benefits: benefits.map((benefit: { capScope?: unknown; sharedKey?: unknown }) =>
      benefit.sharedKey === "sports-win" && benefit.capScope === "day"
        ? { ...benefit, capScope: "occurrence" }
        : benefit,
    ),
  };
};

export const sportsWinOccurrenceMigration: Migration = {
  to: 3,
  stores: { plans: toOccurrence },
};
