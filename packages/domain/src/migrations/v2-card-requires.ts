import { CARD_BONUS_ID, CARD_NORMAL_ID, PREMIUM_CARD_BONUS_ID } from "../master/spu";
import type { Migration } from "./runner";

const CARD_BONUS_IDS = new Set([CARD_BONUS_ID, PREMIUM_CARD_BONUS_ID]);

/** Gives the card bonuses saved before version 2 the `requires` link to the card's normal points. */
const linkCardBonuses =
  (key: "benefits" | "spuBenefits") =>
  (row: unknown): unknown => {
    const record = row as Record<string, unknown>;
    const benefits = record[key];
    if (!Array.isArray(benefits)) return row;
    return {
      ...record,
      [key]: benefits.map((benefit: { id?: unknown }) =>
        typeof benefit.id === "string" && CARD_BONUS_IDS.has(benefit.id)
          ? { ...benefit, requires: CARD_NORMAL_ID }
          : benefit,
      ),
    };
  };

export const cardRequiresMigration: Migration = {
  to: 2,
  stores: { plans: linkCardBonuses("benefits"), profile: linkCardBonuses("spuBenefits") },
};
