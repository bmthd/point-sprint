import {
  type Migration,
  type SeedSource,
  type StoreName,
  migrateRow as runMigrations,
  seedRows as runSeeds,
} from "./runner";
import { cardRequiresMigration } from "./v2-card-requires";
import { dayToOccurrenceMigration } from "./v3-day-to-occurrence";
import { bankTiersMigration } from "./v9-bank-tiers";
import { spuMonthsMigration } from "./v10-spu-months";
import { orderRowsMigration } from "./v11-order-rows";

export type { Migration, SeedSource, StoreName } from "./runner";

// 4 is skipped: databases that lacked the `quarantine` store were bumped to 4 when it was created.
export const CURRENT_SCHEMA_VERSION = 11;

export const migrations: Migration[] = [
  cardRequiresMigration,
  dayToOccurrenceMigration,
  bankTiersMigration,
  spuMonthsMigration,
  orderRowsMigration,
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
