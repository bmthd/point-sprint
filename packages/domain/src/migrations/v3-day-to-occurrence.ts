import type { Migration } from "./runner";

/**
 * Moves the day caps saved before version 3 to occurrence caps; `day` is gone. Only 勝ったら倍 had
 * a day cap, and each was added for one day, so it is one occurrence and its points do not change.
 */
const toOccurrence = (row: unknown): unknown => {
  const record = row as Record<string, unknown>;
  const benefits = record.benefits;
  if (!Array.isArray(benefits)) return row;
  return {
    ...record,
    benefits: benefits.map((benefit: { capScope?: unknown }) =>
      benefit.capScope === "day" ? { ...benefit, capScope: "occurrence" } : benefit,
    ),
  };
};

export const dayToOccurrenceMigration: Migration = {
  to: 3,
  stores: { plans: toOccurrence },
};
