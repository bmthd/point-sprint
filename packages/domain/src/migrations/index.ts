import { type Migration, type StoreName, migrateRow as runMigrations } from "./runner";
import { cardRequiresMigration } from "./v2-card-requires";
import { dayToOccurrenceMigration } from "./v3-day-to-occurrence";

export type { Migration, StoreName } from "./runner";

// 4 is skipped: databases that lacked the `quarantine` store were bumped to 4 when it was created.
export const CURRENT_SCHEMA_VERSION = 6;

export const migrations: Migration[] = [cardRequiresMigration, dayToOccurrenceMigration];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}
