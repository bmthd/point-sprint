import {
  type OrderRow,
  PROFILE_ID,
  type Plan,
  type PlanRow,
  PlanSchema,
  type Profile,
  type Shop,
  type SpuMonth,
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
import * as v from "valibot";
import type { QuarantinedRow, Repository, SyncMeta } from "./repository";

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Mark = { kind: SyncKind; id: string; updatedAt: string };
type Row = { updatedAt: string };

/** Validates on write and hands out copies, ordered by id, like the IndexedDB implementation. */
export function createMemoryRepository(
  initial: {
    plans?: Plan[];
    shops?: Shop[];
    profile?: Profile;
    spuMonths?: SpuMonth[];
    quarantine?: Omit<QuarantinedRow, "key">[];
  } = {},
  { now = () => new Date() }: { now?: () => Date } = {},
): Repository {
  const rows: Record<SyncKind, Map<string, Row>> = {
    plan: new Map(),
    order: new Map(),
    shop: new Map(),
    profile: new Map(),
    spuMonth: new Map(),
  };
  const outbox = new Map<string, Mark>();
  const tombstones = new Map<string, Mark>();
  const quarantine = new Map<number, QuarantinedRow>();
  let meta: SyncMeta | undefined;

  const writeRow = (kind: SyncKind, id: string, row: Row) => {
    rows[kind].set(id, row);
    tombstones.delete(syncKey(kind, id));
    outbox.set(syncKey(kind, id), { kind, id, updatedAt: row.updatedAt });
  };
  const removeRow = (kind: SyncKind, id: string, updatedAt: string) => {
    rows[kind].delete(id);
    const mark = { kind, id, updatedAt };
    tombstones.set(syncKey(kind, id), mark);
    outbox.set(syncKey(kind, id), mark);
  };
  const ordersOf = (planId: string) =>
    [...rows.order.values()].filter((row) => (row as OrderRow).planId === planId) as OrderRow[];

  const planOf = (row: PlanRow) => structuredClone(joinPlan(row, ordersOf(row.id)));
  const updatePlan: Repository["plans"]["update"] = async (id, change, shopChange) => {
    const row = rows.plan.get(id) as PlanRow | undefined;
    const before = row && planOf(row);
    // Both are checked before either is written, as one transaction would.
    const plan = v.parse(PlanSchema, structuredClone(change(before)));
    const stored = shopChange && (rows.shop.get(shopChange.shopId) as Shop | undefined);
    const shop =
      shopChange && v.parse(syncSchemas.shop, structuredClone(shopChange.change(stored)));
    if (shop) putRow("shop", shop.id, shop);
    const after = putPlan(plan);
    return { before, after };
  };
  const putPlan = (plan: Plan) => {
    const parsed = v.parse(PlanSchema, structuredClone(plan));
    const split = splitPlan(parsed, {
      row: rows.plan.get(parsed.id) as PlanRow | undefined,
      orders: ordersOf(parsed.id),
    });
    if (split.row) writeRow("plan", parsed.id, split.row);
    for (const order of split.orders) writeRow("order", orderRowId(parsed.id, order.id), order);
    for (const id of split.removedOrderIds) {
      removeRow("order", orderRowId(parsed.id, id), parsed.updatedAt);
    }
    return parsed;
  };
  const putRow = <T extends Row>(kind: Exclude<SyncKind, "plan" | "order">, id: string, row: T) =>
    writeRow(kind, id, v.parse(syncSchemas[kind], structuredClone(row)) as T);
  const list = <T>(kind: SyncKind) =>
    structuredClone([...rows[kind].values()] as unknown as (T & { id: string })[]).sort(byId);

  initial.plans?.forEach(putPlan);
  initial.spuMonths?.forEach((month) => putRow("spuMonth", month.id, month));
  initial.shops?.forEach((shop) => putRow("shop", shop.id, shop));
  if (initial.profile) putRow("profile", PROFILE_ID, initial.profile);
  initial.quarantine?.forEach((row, key) => quarantine.set(key + 1, { ...row, key: key + 1 }));

  return {
    plans: {
      list: async () => list<PlanRow>("plan").map(planOf),
      get: async (id) => {
        const row = rows.plan.get(id) as PlanRow | undefined;
        return row && planOf(row);
      },
      put: async (plan) => {
        putPlan(plan);
      },
      update: updatePlan,
      delete: async (id) => {
        const removedAt = now().toISOString();
        for (const order of ordersOf(id)) removeRow("order", orderRowId(id, order.id), removedAt);
        removeRow("plan", id, removedAt);
      },
    },
    shops: {
      list: async () => list<Shop>("shop"),
      put: async (shop) => putRow("shop", shop.id, shop),
    },
    profile: {
      get: async () => structuredClone(rows.profile.get(PROFILE_ID) as Profile | undefined),
      put: async (next) => putRow("profile", PROFILE_ID, next),
    },
    spuMonths: {
      list: async () => list<SpuMonth>("spuMonth"),
      put: async (month) => putRow("spuMonth", month.id, month),
    },
    sync: {
      pending: async () =>
        [...outbox.values()].flatMap(({ kind, id }): SyncRow[] => {
          const tombstone = tombstones.get(syncKey(kind, id));
          if (tombstone) return [{ kind, id, updatedAt: tombstone.updatedAt, deleted: true }];
          const value = rows[kind].get(id);
          return value
            ? [
                {
                  kind,
                  id,
                  updatedAt: value.updatedAt,
                  deleted: false,
                  value: structuredClone(value),
                },
              ]
            : [];
        }),
      acknowledge: async (sent) => {
        for (const { kind, id, updatedAt } of sent) {
          const key = syncKey(kind, id);
          if (outbox.get(key)?.updatedAt === updatedAt) outbox.delete(key);
        }
      },
      apply: async (received, accountId) => {
        if (meta?.accountId !== accountId) return false;
        let written = false;
        for (const row of received) {
          const key = syncKey(row.kind, row.id);
          const tombstone = tombstones.get(key);
          const value = rows[row.kind].get(row.id);
          const here: SyncRow | undefined = tombstone
            ? { ...tombstone, deleted: true }
            : value && {
                kind: row.kind,
                id: row.id,
                updatedAt: value.updatedAt,
                deleted: false,
                value,
              };
          if (!wins(row, here)) continue;
          if (row.deleted) {
            removeRow(row.kind, row.id, row.updatedAt);
          } else {
            const parsed = v.safeParse(syncSchemas[row.kind], structuredClone(row.value));
            if (!parsed.success) {
              const next = Math.max(0, ...quarantine.keys()) + 1;
              quarantine.set(next, {
                key: next,
                store: syncStores[row.kind],
                value: row.value,
                issues: parsed.issues.map((issue) => ({
                  message: issue.message,
                  path: (issue.path ?? []).map((segment) => String(segment.key)),
                })),
              });
              continue;
            }
            writeRow(row.kind, row.id, parsed.output);
          }
          outbox.delete(key);
          written = true;
        }
        return written;
      },
      markAllPending: async () => {
        for (const kind of Object.keys(rows) as SyncKind[]) {
          for (const [id, row] of rows[kind]) {
            outbox.set(syncKey(kind, id), { kind, id, updatedAt: row.updatedAt });
          }
        }
        for (const [key, mark] of tombstones) outbox.set(key, mark);
      },
      meta: {
        get: async () => meta,
        put: async (next) => {
          meta = next;
        },
      },
    },
    clear: async () => {
      for (const store of Object.values(rows)) store.clear();
      outbox.clear();
      tombstones.clear();
      quarantine.clear();
      meta = undefined;
    },
    quarantined: async () => quarantine.size,
    quarantine: {
      list: async () => structuredClone([...quarantine.values()]),
      delete: async (key) => {
        quarantine.delete(key);
      },
      clear: async () => quarantine.clear(),
    },
    wasReset: () => false,
  };
}
