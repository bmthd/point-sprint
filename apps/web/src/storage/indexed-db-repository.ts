import {
  CURRENT_SCHEMA_VERSION,
  type Migration,
  migrateRow,
  migrations as domainMigrations,
  type OrderRow,
  OrderRowSchema,
  PROFILE_ID,
  type Plan,
  type PlanRow,
  PlanRowSchema,
  PlanSchema,
  type Profile,
  ProfileSchema,
  seedRows,
  type Shop,
  ShopSchema,
  type SpuMonth,
  SpuMonthSchema,
  type StoreName,
  type SyncKind,
  type SyncRow,
  joinPlan,
  orderRowId,
  splitPlan,
  syncKey,
  syncSchemas,
  syncStores,
  wins,
} from "@workspaces/domain";
import { createIndexedDb } from "seitu/web/indexed-db";
import { createIndexedDbTable } from "seitu/web/indexed-db-table";
import * as v from "valibot";
import {
  OutdatedDatabaseError,
  type QuarantinedRow,
  type Repository,
  type SyncMeta,
} from "./repository";

const PROFILE_KEY = "profile";
const SYNC_META_KEY = "meta";

const QuarantineSchema = v.object({
  store: v.picklist(["plans", "orders", "shops", "profile", "spuMonths"]),
  value: v.unknown(),
  issues: v.array(v.object({ message: v.string(), path: v.array(v.string()) })),
});

type Issue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: unknown }> | undefined;
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

const schemas = {
  plans: PlanRowSchema,
  orders: OrderRowSchema,
  shops: ShopSchema,
  profile: ProfileSchema,
  spuMonths: SpuMonthSchema,
};

/** A row marked to send, or the mark that a row was removed, keyed by `syncKey`. */
const SyncMarkSchema = v.object({
  kind: v.picklist(["plan", "order", "shop", "profile", "spuMonth"]),
  id: v.string(),
  updatedAt: v.string(),
});
type SyncMark = v.InferOutput<typeof SyncMarkSchema>;

const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof value === "object" && value !== null && "algorithm" in value && "usages" in value;
const SyncMetaSchema = v.object({
  masterWrap: v.optional(v.string()),
  accountId: v.string(),
  credentialId: v.optional(v.string()),
  cursor: v.number(),
  encryptionKey: v.custom<CryptoKey>(isCryptoKey),
  idKey: v.custom<CryptoKey>(isCryptoKey),
});

const ROW_STORES = ["plans", "orders", "shops", "profile", "spuMonths"] as const;
const STORES = [...ROW_STORES, "quarantine", "outbox", "tombstones", "syncMeta"] as const;

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The key of a row in its store: the profile has one fixed key, an order its plan's and its own id. */
const rowKey = (kind: SyncKind, id: string): IDBValidKey =>
  kind === "profile" ? PROFILE_KEY : kind === "order" ? id.split(":") : id;

/** The sync id of a stored row, which `rowKey` turns back into its key. */
const syncIdOf = (kind: SyncKind, row: { id?: string; planId?: string }) =>
  kind === "profile"
    ? PROFILE_ID
    : kind === "order"
      ? orderRowId(row.planId ?? "", row.id ?? "")
      : (row.id ?? "");

/** Writes a row and marks it to send; a row written again is no longer removed. */
function writeRow(
  transaction: IDBTransaction,
  kind: SyncKind,
  id: string,
  row: { updatedAt: string },
) {
  const store = transaction.objectStore(syncStores[kind]);
  if (kind === "profile") store.put(row, PROFILE_KEY);
  else store.put(row);
  const key = syncKey(kind, id);
  transaction.objectStore("tombstones").delete(key);
  transaction
    .objectStore("outbox")
    .put({ kind, id, updatedAt: row.updatedAt } satisfies SyncMark, key);
}

/** Removes a row, keeps the mark that it was removed, and marks the removal to send. */
function removeRow(transaction: IDBTransaction, kind: SyncKind, id: string, updatedAt: string) {
  transaction.objectStore(syncStores[kind]).delete(rowKey(kind, id));
  const key = syncKey(kind, id);
  const mark: SyncMark = { kind, id, updatedAt };
  transaction.objectStore("tombstones").put(mark, key);
  transaction.objectStore("outbox").put(mark, key);
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

type OpenState = {
  /** Moves to `quarantine` in flight, keyed by store and row key so a row is moved at most once. */
  moves: Map<string, Promise<void>>;
  /** Set when a migration transform threw, which is the only failure that allows a reset. */
  migrationFailed: boolean;
};

const schemaVersion = (migrations: readonly Migration[]) =>
  Math.max(CURRENT_SCHEMA_VERSION, ...migrations.map((m) => m.to));

function openDatabase(name: string, migrations: readonly Migration[], state: OpenState) {
  // The IndexedDB version doubles as the schema version that `onUpgrade` migrates from. Seitu
  // bumps it on its own when a store or index is missing, so never add a store or an index
  // without bumping CURRENT_SCHEMA_VERSION, or later migrations would be skipped.
  const version = schemaVersion(migrations);

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
    await completion(transaction);
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

  // Reads the plans and the profile as they are before `migrate` rewrites them (requests run in
  // the order they are made), and writes the rows the migrations' seeds make from them.
  const seed = (transaction: IDBTransaction, oldVersion: number) => {
    const plans = transaction.objectStore("plans").getAll();
    const profile = transaction.objectStore("profile").get(PROFILE_KEY);
    profile.onsuccess = () => {
      let rows: ReturnType<typeof seedRows>;
      try {
        rows = seedRows({ plans: plans.result, profile: profile.result }, oldVersion, migrations);
      } catch (error) {
        state.migrationFailed = true;
        throw error;
      }
      for (const [store, values] of Object.entries(rows)) {
        for (const value of values) transaction.objectStore(store).put(value);
      }
    };
  };

  const db = createIndexedDb({
    name,
    version,
    stores: {
      plans: createIndexedDbTable({
        keyPath: "id",
        schema: PlanRowSchema,
        onValidationError: quarantine("plans", idOf),
      }),
      orders: createIndexedDbTable({
        keyPath: ["planId", "id"],
        schema: OrderRowSchema,
        indexes: { planId: "planId" },
        onValidationError: quarantine("orders", (value) => {
          const { planId, id } = value as { planId: string; id: string };
          return [planId, id];
        }),
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
      spuMonths: createIndexedDbTable({
        keyPath: "id",
        schema: SpuMonthSchema,
        onValidationError: quarantine("spuMonths", idOf),
      }),
      quarantine: createIndexedDbTable({ autoIncrement: true, schema: QuarantineSchema }),
      outbox: createIndexedDbTable({ schema: SyncMarkSchema }),
      tombstones: createIndexedDbTable({ schema: SyncMarkSchema }),
      // A device that does not sync has no row: absence, not bad data.
      syncMeta: createIndexedDbTable({
        schema: SyncMetaSchema,
        onValidationError: () => undefined,
      }),
    },
    onUpgrade: ({ oldVersion, migrate, transaction }) => {
      // A new database (oldVersion 0) has no rows; an index-only bump has no migrations to apply.
      if (oldVersion === 0 || !migrations.some((m) => m.to > oldVersion)) return;
      if (migrations.some((m) => m.to > oldVersion && m.seed)) seed(transaction, oldVersion);
      migrate("plans", migrateWith<PlanRow>("plans", oldVersion));
      migrate("orders", migrateWith<OrderRow>("orders", oldVersion));
      migrate("shops", migrateWith<Shop>("shops", oldVersion));
      migrate("profile", migrateWith<Profile>("profile", oldVersion));
      migrate("spuMonths", migrateWith<SpuMonth>("spuMonths", oldVersion));
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
    /** When a removal happens, which is when it was made for the other devices. */
    now?: () => Date;
  } = {},
): Repository {
  const name = options.name ?? "point-sprint";
  const migrations = options.migrations ?? domainMigrations;
  const now = () => (options.now?.() ?? new Date()).toISOString();
  const version = schemaVersion(migrations);
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
    // Seitu reopens at whatever version a newer app upgraded the database to. Reading its rows
    // here would set aside the ones this app cannot parse, and writing would overwrite them.
    if ((await db["~"].getDatabase()).version > version) throw new OutdatedDatabaseError();
    await Promise.all(state.moves.values());
    return db;
  };

  const transaction = async (stores: readonly string[], mode: IDBTransactionMode) => {
    const database = await (await settled())["~"].getDatabase();
    const opened = database.transaction(stores, mode);
    return { transaction: opened, done: completion(opened) };
  };

  /** Writes one row of a store that holds no plan's parts, with its mark to send. */
  const putRow = async <T extends { updatedAt: string }>(
    kind: Exclude<SyncKind, "plan" | "order">,
    id: (row: T) => string,
    row: T,
  ) => {
    const parsed = v.parse(syncSchemas[kind], structuredClone(row)) as T;
    const { transaction: tx, done } = await transaction(
      [syncStores[kind], "outbox", "tombstones"],
      "readwrite",
    );
    writeRow(tx, kind, id(parsed), parsed);
    await done;
  };

  // The plan's row and the orders that changed, and the shop saved with them, are written with
  // their marks to send in the transaction they were read in, so a change is never saved without
  // being sent later, and a row received meanwhile is never taken for one the change removed.
  const update: Repository["plans"]["update"] = async (id, change, shopChange) => {
    const { transaction: tx, done } = await transaction(
      ["plans", "orders", "shops", "outbox", "tombstones"],
      "readwrite",
    );
    const [row, orders, storedShop] = await Promise.all([
      request<PlanRow | undefined>(tx.objectStore("plans").get(id)),
      request<OrderRow[]>(tx.objectStore("orders").index("planId").getAll(id)),
      shopChange && request<Shop | undefined>(tx.objectStore("shops").get(shopChange.shopId)),
    ]);
    const before = row && joinPlan(row, orders);
    let after: Plan;
    let shop: Shop | undefined;
    try {
      after = v.parse(PlanSchema, structuredClone(change(before)));
      shop = shopChange && v.parse(ShopSchema, structuredClone(shopChange.change(storedShop)));
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    if (shop) writeRow(tx, "shop", shop.id, shop);
    const split = splitPlan(after, { row, orders });
    if (split.row) writeRow(tx, "plan", after.id, split.row);
    for (const order of split.orders) {
      writeRow(tx, "order", orderRowId(after.id, order.id), order);
    }
    for (const removed of split.removedOrderIds) {
      removeRow(tx, "order", orderRowId(after.id, removed), after.updatedAt);
    }
    await done;
    return { before, after };
  };

  return {
    plans: {
      list: async () => {
        const db = await settled();
        const [rows, orders] = await Promise.all([
          db.stores.plans.getAll(),
          db.stores.orders.getAll(),
        ]);
        return rows.map((row) => joinPlan(row, orders));
      },
      get: async (id) => {
        const db = await settled();
        const row = await db.stores.plans.get(id);
        return row && joinPlan(row, await db.stores.orders.index("planId").getAll(id));
      },
      put: async (plan) => {
        await update(plan.id, () => plan);
      },
      update,
      delete: async (id) => {
        const removedAt = now();
        const { transaction: tx, done } = await transaction(
          ["plans", "orders", "outbox", "tombstones"],
          "readwrite",
        );
        const orders = await request<OrderRow[]>(
          tx.objectStore("orders").index("planId").getAll(id),
        );
        removeRow(tx, "plan", id, removedAt);
        for (const order of orders) removeRow(tx, "order", orderRowId(id, order.id), removedAt);
        await done;
      },
    },
    shops: {
      list: async () => (await settled()).stores.shops.getAll(),
      put: (shop) => putRow<Shop>("shop", (row) => row.id, shop),
      update: async (id, change) => {
        const { transaction: tx, done } = await transaction(
          ["shops", "outbox", "tombstones"],
          "readwrite",
        );
        const stored = await request<Shop | undefined>(tx.objectStore("shops").get(id));
        let shop: Shop;
        try {
          shop = v.parse(ShopSchema, structuredClone(change(stored)));
        } catch (error) {
          tx.abort();
          await done.catch(() => {});
          throw error;
        }
        writeRow(tx, "shop", shop.id, shop);
        await done;
      },
    },
    profile: {
      get: async () => (await settled()).stores.profile.get(PROFILE_KEY),
      put: (profile) => putRow<Profile>("profile", () => PROFILE_ID, profile),
    },
    spuMonths: {
      list: async () => (await settled()).stores.spuMonths.getAll(),
      put: (month) => putRow<SpuMonth>("spuMonth", (row) => row.id, month),
    },
    sync: {
      pending: async () => {
        const { transaction: tx, done } = await transaction(
          [...ROW_STORES, "outbox", "tombstones"],
          "readonly",
        );
        const marks = await request<SyncMark[]>(tx.objectStore("outbox").getAll());
        const rows = await Promise.all(
          marks.map(async ({ kind, id }): Promise<SyncRow | undefined> => {
            const [tombstone, value] = await Promise.all([
              request<SyncMark | undefined>(tx.objectStore("tombstones").get(syncKey(kind, id))),
              request<{ updatedAt: string } | undefined>(
                tx.objectStore(syncStores[kind]).get(rowKey(kind, id)),
              ),
            ]);
            if (tombstone) return { kind, id, updatedAt: tombstone.updatedAt, deleted: true };
            return value && { kind, id, updatedAt: value.updatedAt, deleted: false, value };
          }),
        );
        await done;
        return rows.filter((row) => row !== undefined);
      },
      acknowledge: async (rows) => {
        const { transaction: tx, done } = await transaction(["outbox"], "readwrite");
        const outbox = tx.objectStore("outbox");
        await Promise.all(
          rows.map(async ({ kind, id, updatedAt }) => {
            const key = syncKey(kind, id);
            const mark = await request<SyncMark | undefined>(outbox.get(key));
            if (mark?.updatedAt === updatedAt) outbox.delete(key);
          }),
        );
        await done;
      },
      apply: async (rows, accountId) => {
        const { transaction: tx, done } = await transaction(
          [...ROW_STORES, "outbox", "tombstones", "quarantine", "syncMeta"],
          "readwrite",
        );
        // Checked in the transaction the rows are written in: a device that stopped syncing, or
        // was reset, while the rows were on their way keeps none of them.
        const meta = await request<SyncMeta | undefined>(
          tx.objectStore("syncMeta").get(SYNC_META_KEY),
        );
        if (meta?.accountId !== accountId) {
          await done;
          return false;
        }
        const written = await Promise.all(
          rows.map(async (row) => {
            const key = syncKey(row.kind, row.id);
            const [tombstone, current] = await Promise.all([
              request<SyncMark | undefined>(tx.objectStore("tombstones").get(key)),
              request<{ updatedAt: string } | undefined>(
                tx.objectStore(syncStores[row.kind]).get(rowKey(row.kind, row.id)),
              ),
            ]);
            const here: SyncRow | undefined = tombstone
              ? { ...tombstone, deleted: true }
              : current && {
                  kind: row.kind,
                  id: row.id,
                  updatedAt: current.updatedAt,
                  deleted: false,
                  value: current,
                };
            if (!wins(row, here)) return false;
            if (row.deleted) {
              removeRow(tx, row.kind, row.id, row.updatedAt);
              tx.objectStore("outbox").delete(key);
              return true;
            }
            const parsed = v.safeParse(syncSchemas[row.kind], row.value);
            if (!parsed.success) {
              tx.objectStore("quarantine").add({
                store: syncStores[row.kind],
                value: row.value,
                issues: plainIssues(parsed.issues),
              });
              return false;
            }
            writeRow(tx, row.kind, row.id, parsed.output);
            tx.objectStore("outbox").delete(key);
            return true;
          }),
        );
        await done;
        return written.some(Boolean);
      },
      markAllPending: async () => {
        const { transaction: tx, done } = await transaction(
          [...ROW_STORES, "outbox", "tombstones"],
          "readwrite",
        );
        const outbox = tx.objectStore("outbox");
        const kinds = Object.keys(syncStores) as SyncKind[];
        await Promise.all([
          ...kinds.map(async (kind) => {
            const rows = await request<{ id?: string; planId?: string; updatedAt: string }[]>(
              tx.objectStore(syncStores[kind]).getAll(),
            );
            for (const row of rows) {
              const id = syncIdOf(kind, row);
              outbox.put(
                { kind, id, updatedAt: row.updatedAt } satisfies SyncMark,
                syncKey(kind, id),
              );
            }
          }),
          request<SyncMark[]>(tx.objectStore("tombstones").getAll()).then((marks) => {
            for (const mark of marks) outbox.put(mark, syncKey(mark.kind, mark.id));
          }),
        ]);
        await done;
      },
      meta: {
        get: async () => (await settled()).stores.syncMeta.get(SYNC_META_KEY),
        put: async (meta) => {
          const db = await settled();
          if (meta) await db.stores.syncMeta.put(meta, SYNC_META_KEY);
          else await db.stores.syncMeta.delete(SYNC_META_KEY);
        },
      },
    },
    clear: async () => {
      const database = await (await settled())["~"].getDatabase();
      const transaction = database.transaction(STORES, "readwrite");
      for (const store of STORES) transaction.objectStore(store).clear();
      await completion(transaction);
    },
    quarantined: async () => (await settled()).stores.quarantine.count(),
    quarantine: {
      // Rows and keys come from one transaction, so they always line up.
      list: async () => {
        const database = await (await settled())["~"].getDatabase();
        const transaction = database.transaction("quarantine", "readonly");
        const store = transaction.objectStore("quarantine");
        const rows = store.getAll();
        const keys = store.getAllKeys();
        await completion(transaction);
        return (rows.result as Omit<QuarantinedRow, "key">[]).map((row, index) => ({
          ...row,
          key: keys.result[index] as number,
        }));
      },
      delete: async (key) => (await settled()).stores.quarantine.delete(key),
      clear: async () => (await settled()).stores.quarantine.clear(),
    },
    wasReset: () => reset,
  };
}
