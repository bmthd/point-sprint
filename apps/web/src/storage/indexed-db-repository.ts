import {
  CURRENT_SCHEMA_VERSION,
  type Migration,
  migrateRow,
  migrations as domainMigrations,
  type Plan,
  PlanSchema,
  type Profile,
  ProfileSchema,
  type Shop,
  ShopSchema,
  type StoreName,
} from "@workspaces/domain";
import { createIndexedDb } from "seitu/web/indexed-db";
import { createIndexedDbTable } from "seitu/web/indexed-db-table";
import * as v from "valibot";
import type { Repository } from "./repository";

const PROFILE_KEY = "profile";

const QuarantineSchema = v.object({
  store: v.picklist(["plans", "shops", "profile"]),
  value: v.unknown(),
  issues: v.array(v.object({ message: v.string(), path: v.array(v.string()) })),
});

type Issue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
};

/** Plain, cloneable copies of the issues: validator issues may hold functions IndexedDB cannot store. */
const plainIssues = (issues: readonly Issue[]) =>
  issues.map((issue) => ({
    message: issue.message,
    path: (issue.path ?? []).map((segment) =>
      String(typeof segment === "object" ? segment.key : segment),
    ),
  }));

type Rejected = { store: StoreName; key: IDBValidKey; issues: readonly Issue[] };

const schemas = { plans: PlanSchema, shops: ShopSchema, profile: ProfileSchema };

type OpenState = {
  /** Moves to `quarantine` in flight, keyed by store and row key so a row is moved at most once. */
  moves: Map<string, Promise<void>>;
  /** Set when a migration transform threw, which is the only failure that allows a reset. */
  migrationFailed: boolean;
};

function openDatabase(name: string, migrations: readonly Migration[], state: OpenState) {
  // The IndexedDB version doubles as the schema version that `onUpgrade` migrates from. Seitu
  // bumps it on its own when a store or index is missing, so never add a store or an index
  // without bumping CURRENT_SCHEMA_VERSION, or later migrations would be skipped.
  const version = Math.max(CURRENT_SCHEMA_VERSION, ...migrations.map((m) => m.to));

  // Re-reads the row in one transaction with the `quarantine` write, and moves it only if it is
  // still invalid, so a valid row written after the failed read is never removed.
  const move = async ({ store, key, issues }: Rejected) => {
    const database = await db["~"].getDatabase();
    const transaction = database.transaction([store, "quarantine"], "readwrite");
    const source = transaction.objectStore(store);
    const read = source.get(key);
    read.onsuccess = () => {
      const current: unknown = read.result;
      if (current === undefined || v.safeParse(schemas[store], current).success) return;
      transaction
        .objectStore("quarantine")
        .add({ store, value: current, issues: plainIssues(issues) });
      source.delete(key);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };

  // `onValidationError` is synchronous, so the move runs in the background and every repository
  // call waits for it. Returning nothing drops the row from the read result.
  const quarantine =
    (store: StoreName, keyOf: (value: unknown) => IDBValidKey) =>
    ({ value, issues }: { value: unknown; issues: readonly Issue[] }) => {
      // A `get` of a missing key validates `undefined`; that is absence, not bad data.
      if (value === undefined) return;
      const key = keyOf(value);
      const id = `${store}:${String(key)}`;
      if (state.moves.has(id)) return;
      const running = move({ store, key, issues })
        .catch((error: unknown) => {
          console.warn(`[repository] Could not quarantine ${id}`, error);
        })
        .finally(() => state.moves.delete(id));
      state.moves.set(id, running);
    };
  const idOf = (value: unknown) => (value as { id: IDBValidKey }).id;

  const migrateWith =
    <Row>(store: StoreName, oldVersion: number) =>
    (row: Row): Row => {
      try {
        return migrateRow(store, row, oldVersion, migrations) as Row;
      } catch (error) {
        state.migrationFailed = true;
        throw error;
      }
    };

  const db = createIndexedDb({
    name,
    version,
    stores: {
      plans: createIndexedDbTable({
        keyPath: "id",
        schema: PlanSchema,
        onValidationError: quarantine("plans", idOf),
      }),
      shops: createIndexedDbTable({
        keyPath: "id",
        schema: ShopSchema,
        onValidationError: quarantine("shops", idOf),
      }),
      profile: createIndexedDbTable({
        schema: ProfileSchema,
        onValidationError: quarantine("profile", () => PROFILE_KEY),
      }),
      quarantine: createIndexedDbTable({ autoIncrement: true, schema: QuarantineSchema }),
    },
    onUpgrade: ({ oldVersion, migrate }) => {
      // A new database (oldVersion 0) has no rows; an index-only bump has no migrations to apply.
      if (oldVersion === 0 || !migrations.some((m) => m.to > oldVersion)) return;
      migrate("plans", migrateWith<Plan>("plans", oldVersion));
      migrate("shops", migrateWith<Shop>("shops", oldVersion));
      migrate("profile", migrateWith<Profile>("profile", oldVersion));
    },
  });
  return db;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbRepository(
  options: {
    name?: string;
    /** Tests only: replaces the domain migrations. */
    migrations?: readonly Migration[];
  } = {},
): Repository {
  const name = options.name ?? "point-sprint";
  const migrations = options.migrations ?? domainMigrations;
  const state: OpenState = { moves: new Map(), migrationFailed: false };
  let reset = false;
  let opened: Promise<ReturnType<typeof openDatabase>> | undefined;

  // Opens lazily so that creating the repository touches no browser API. A failed migration
  // leaves the database on its old version with every access rejecting: start over empty.
  // Any other failure is passed on, and the next call tries to open again.
  const open = async () => {
    const db = openDatabase(name, migrations, state);
    try {
      await db.stores.quarantine.count();
      return db;
    } catch (error) {
      db.close();
      if (!state.migrationFailed) throw error;
      await deleteDatabase(name);
      state.migrationFailed = false;
      reset = true;
      return openDatabase(name, migrations, state);
    }
  };
  const connect = () =>
    (opened ??= open().catch((error: unknown) => {
      opened = undefined;
      throw error;
    }));
  // Waiting for moves to `quarantine` in flight keeps a read from seeing a row being moved.
  const settled = async () => {
    const db = await connect();
    await Promise.all(state.moves.values());
    return db;
  };

  return {
    plans: {
      list: async () => (await settled()).stores.plans.getAll(),
      get: async (id) => (await settled()).stores.plans.get(id),
      put: async (plan) => (await settled()).stores.plans.put(plan),
      delete: async (id) => (await settled()).stores.plans.delete(id),
    },
    shops: {
      list: async () => (await settled()).stores.shops.getAll(),
      put: async (shop) => (await settled()).stores.shops.put(shop),
    },
    profile: {
      get: async () => (await settled()).stores.profile.get(PROFILE_KEY),
      put: async (profile) => (await settled()).stores.profile.put(profile, PROFILE_KEY),
    },
    quarantined: async () => (await settled()).stores.quarantine.count(),
    wasReset: () => reset,
  };
}
