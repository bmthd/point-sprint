export type StoreName = "plans" | "shops" | "profile";

export type Migration = {
  to: number;
  stores: Partial<Record<StoreName, (row: unknown) => unknown>>;
};

/** Applies every migration with `to > fromVersion`, ascending by `to`. Transforms must be synchronous and pure. */
export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[],
): unknown {
  return [...list]
    .filter((m) => m.to > fromVersion)
    .sort((a, b) => a.to - b.to)
    .reduce((current, m) => {
      const transform = m.stores[store];
      return transform ? transform(current) : current;
    }, row);
}
