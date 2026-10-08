import { type Migration, type StoreName, migrateRow as runMigrations } from "./runner";
import { cardRequiresMigration } from "./v2-card-requires";

export type { Migration, StoreName } from "./runner";

export const CURRENT_SCHEMA_VERSION = 2;

export const migrations: Migration[] = [cardRequiresMigration];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}
