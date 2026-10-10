import { type Migration, type StoreName, migrateRow as runMigrations } from "./runner";
import { cardRequiresMigration } from "./v2-card-requires";
import { sportsWinOccurrenceMigration } from "./v3-sports-win-occurrence";

export type { Migration, StoreName } from "./runner";

export const CURRENT_SCHEMA_VERSION = 3;

export const migrations: Migration[] = [cardRequiresMigration, sportsWinOccurrenceMigration];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}
