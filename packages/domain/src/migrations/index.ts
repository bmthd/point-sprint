import {
  type Migration,
  type SeedSource,
  type StoreName,
  migrateRow as runMigrations,
  seedRows as runSeeds,
} from "./runner.ts";
import { cardRequiresMigration } from "./v2-card-requires.ts";
import { dayToOccurrenceMigration } from "./v3-day-to-occurrence.ts";
import { bankTiersMigration } from "./v9-bank-tiers.ts";
import { spuMonthsMigration } from "./v10-spu-months.ts";
import { orderRowsMigration } from "./v11-order-rows.ts";
import { twoShopCampaignMigration } from "./v12-two-shop-campaign.ts";
import { rakumaMigration } from "./v16-rakuma.ts";

export type { Migration, SeedSource, StoreName } from "./runner.ts";

// 4 is skipped: databases that lacked the `quarantine` store were bumped to 4 when it was created.
// 5–8 needed no row transforms: 5 added the old-tab guard (#148), 6 added spend-tiers (#169),
// 7 added order tags for official events (#181), and 8 added the 24h order tag (#185).
// 13 added the `noticeReads` store, which needs no row transforms either.
// 14 added the plan's `onHold`.
// 15 shortened new ids to 10 lowercase letters and digits; saved uuids stay valid.
// 16 added the ラクマ購入 +1倍 to the plans of official events, and the `minShopAmount` condition.
// The version bumps keep older tabs from reading or overwriting values they do not understand.
export const CURRENT_SCHEMA_VERSION = 16;

export const migrations: Migration[] = [
  cardRequiresMigration,
  dayToOccurrenceMigration,
  bankTiersMigration,
  spuMonthsMigration,
  orderRowsMigration,
  twoShopCampaignMigration,
  rakumaMigration,
];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}

export function seedRows(
  source: SeedSource,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): Partial<Record<StoreName, unknown[]>> {
  return runSeeds(source, fromVersion, list);
}
