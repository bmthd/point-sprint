import { type Migration, type StoreName, migrateRow as runMigrations } from "./runner";

export type { Migration, StoreName } from "./runner";

export const CURRENT_SCHEMA_VERSION = 1;

export const migrations: Migration[] = [];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}
