import { type Migration, type StoreName, migrateRow as runMigrations } from "./runner";
import { cardRequiresMigration } from "./v2-card-requires";
import { dayToOccurrenceMigration } from "./v3-day-to-occurrence";
import { orderPurchasesMigration } from "./v4-order-purchases";
export { migrateOrderPurchases } from "./v4-order-purchases";

export type { Migration, StoreName } from "./runner";

export const CURRENT_SCHEMA_VERSION = 4;

export const migrations: Migration[] = [
  cardRequiresMigration,
  dayToOccurrenceMigration,
  orderPurchasesMigration,
];

export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[] = migrations,
): unknown {
  return runMigrations(store, row, fromVersion, list);
}
