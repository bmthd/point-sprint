import type { Migration } from "./runner";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Moves saved 勝ったら倍 caps from a calendar day to each campaign occurrence. */
export const sportsWinOccurrenceMigration: Migration = {
  to: 3,
  stores: {
    plans: (row: unknown): unknown => {
      if (!isRecord(row) || !Array.isArray(row.benefits)) return row;
      return {
        ...row,
        benefits: row.benefits.map((benefit) => {
          if (!isRecord(benefit)) return benefit;
          return benefit.sharedKey === "sports-win" && benefit.capScope === "day"
            ? { ...benefit, capScope: "occurrence" }
            : benefit;
        }),
      };
    },
  },
};
