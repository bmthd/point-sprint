export type StoreName = "plans" | "shops" | "profile" | "spuMonths";

/** The rows a migration's `seed` is made from: every plan and the profile (`undefined` if none). */
export type SeedSource = { plans: unknown[]; profile: unknown };

export type Migration = {
  to: number;
  stores: Partial<Record<StoreName, (row: unknown) => unknown>>;
  /**
   * The rows of a store added at this version, made from the rows of the other stores as they are
   * just before it. Must be synchronous and pure, and must not throw on rows it cannot read.
   */
  seed?: { store: StoreName; rows: (source: SeedSource) => unknown[] };
};

const after = (fromVersion: number, list: readonly Migration[]) =>
  [...list].filter((m) => m.to > fromVersion).sort((a, b) => a.to - b.to);

/** Applies every migration with `to > fromVersion`, ascending by `to`. Transforms must be synchronous and pure. */
export function migrateRow(
  store: StoreName,
  row: unknown,
  fromVersion: number,
  list: readonly Migration[],
): unknown {
  return after(fromVersion, list).reduce((current, m) => {
    const transform = m.stores[store];
    return transform ? transform(current) : current;
  }, row);
}

/**
 * The rows the seeds of the migrations after `fromVersion` add, by store. Each seed gets the rows
 * migrated up to just before its version.
 */
export function seedRows(
  source: SeedSource,
  fromVersion: number,
  list: readonly Migration[],
): Partial<Record<StoreName, unknown[]>> {
  const seeded: Partial<Record<StoreName, unknown[]>> = {};
  let current = source;
  let version = fromVersion;
  for (const m of after(fromVersion, list)) {
    if (m.seed) {
      const before = after(version, list).filter((earlier) => earlier.to < m.to);
      current = {
        plans: current.plans.map((row) => migrateRow("plans", row, version, before)),
        profile:
          current.profile === undefined
            ? undefined
            : migrateRow("profile", current.profile, version, before),
      };
      version = m.to - 1;
      seeded[m.seed.store] = [...(seeded[m.seed.store] ?? []), ...m.seed.rows(current)];
    }
  }
  return seeded;
}
