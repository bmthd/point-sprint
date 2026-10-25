import "fake-indexeddb/auto";
import { type Order, type Plan, type SyncRow, orderRowId } from "@workspaces/domain";
import { describe, expect, test } from "vitest";
import { createIndexedDbRepository } from "./indexed-db-repository";
import { createMemoryRepository } from "./memory-repository";
import type { Repository } from "./repository";

// The rows to send and the rows received, the same in both repositories.

const EARLIER = "2026-10-05T00:00:00.000Z";
const LATER = "2026-10-06T00:00:00.000Z";
const REMOVED_AT = new Date("2026-10-07T00:00:00.000Z");
const PLAN_ID = "00000000-0000-4000-8000-000000000001";
const SHOP_ID = "00000000-0000-4000-8000-000000000002";

const orderId = (n: number) => orderRowId(PLAN_ID, order(n).id);

const order = (n: number, unitPrice = 1000): Order => ({
  id: `00000000-0000-4000-8000-00000000010${n}`,
  date: "2026-10-05",
  lineItems: [
    {
      id: `00000000-0000-4000-8000-00000000020${n}`,
      name: `item ${n}`,
      unitPrice,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
  shopId: SHOP_ID,
});

const plan = (orders: Order[], updatedAt = EARLIER, id = PLAN_ID): Plan => ({
  id,
  name: "お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-11" },
  benefits: [],
  orders,
  updatedAt,
});

const keys = (rows: SyncRow[]) => rows.map((row) => `${row.kind}:${row.id}:${row.deleted}`).sort();

let counter = 0;
const ACCOUNT = "account";

/** A repository of a device that syncs with `ACCOUNT`. */
async function syncing(repository: Repository): Promise<Repository> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  await repository.sync.meta.put({ accountId: ACCOUNT, cursor: 0, encryptionKey: key, idKey: key });
  return repository;
}

const repositories: [string, () => Repository][] = [
  [
    "IndexedDB",
    () => createIndexedDbRepository({ name: `sync-${counter++}`, now: () => REMOVED_AT }),
  ],
  ["memory", () => createMemoryRepository({}, { now: () => REMOVED_AT })],
];

describe.each(repositories)("%s", (_name, make) => {
  const create = () => syncing(make());
  test("a plan comes back with its orders in order", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(2), order(1)]));
    expect(await repository.plans.get(PLAN_ID)).toEqual(plan([order(2), order(1)]));
    expect(await repository.plans.list()).toEqual([plan([order(2), order(1)])]);
  });

  test("editing one order marks that order only", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1), order(2)]));
    await repository.sync.acknowledge(await repository.sync.pending());
    await repository.plans.put(plan([order(1), order(2, 2000)], LATER));
    const pending = await repository.sync.pending();
    expect(keys(pending)).toEqual([`order:${orderId(2)}:false`]);
    expect(pending[0]).toMatchObject({ updatedAt: LATER, value: { planId: PLAN_ID } });
  });

  test("removing a plan marks it and its orders removed", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)]));
    await repository.sync.acknowledge(await repository.sync.pending());
    await repository.plans.delete(PLAN_ID);
    expect(await repository.plans.list()).toEqual([]);
    const pending = await repository.sync.pending();
    expect(keys(pending)).toEqual([`order:${orderId(1)}:true`, `plan:${PLAN_ID}:true`]);
    expect(pending.every((row) => row.updatedAt === REMOVED_AT.toISOString())).toBe(true);
  });

  test("a row written again after it was sent stays marked", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)]));
    const sent = await repository.sync.pending();
    await repository.plans.put(plan([order(1, 2000)], LATER));
    await repository.sync.acknowledge(sent);
    expect(keys(await repository.sync.pending())).toEqual([`order:${orderId(1)}:false`]);
  });

  test("a received row is written only when it is newer, and is not marked to send", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)], LATER));
    await repository.sync.acknowledge(await repository.sync.pending());

    const older = { ...order(1, 500), planId: PLAN_ID, position: 0, updatedAt: EARLIER };
    const newer = {
      ...order(1, 3000),
      planId: PLAN_ID,
      position: 0,
      updatedAt: "2026-10-08T00:00:00.000Z",
    };
    expect(
      await repository.sync.apply(
        [{ kind: "order", id: orderId(1), updatedAt: EARLIER, deleted: false, value: older }],
        ACCOUNT,
      ),
    ).toBe(false);
    expect((await repository.plans.get(PLAN_ID))?.orders).toEqual([order(1)]);
    expect(
      await repository.sync.apply(
        [
          {
            kind: "order",
            id: orderId(1),
            updatedAt: newer.updatedAt,
            deleted: false,
            value: newer,
          },
        ],
        ACCOUNT,
      ),
    ).toBe(true);
    expect((await repository.plans.get(PLAN_ID))?.orders).toEqual([order(1, 3000)]);
    expect(await repository.sync.pending()).toEqual([]);
  });

  test("a removal received is not undone by an older row", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)]));
    await repository.sync.apply(
      [
        { kind: "plan", id: PLAN_ID, updatedAt: LATER, deleted: true },
        { kind: "order", id: orderId(1), updatedAt: LATER, deleted: true },
      ],
      ACCOUNT,
    );
    expect(await repository.plans.list()).toEqual([]);
    const { orders: _, ...row } = plan([]);
    await repository.sync.apply(
      [{ kind: "plan", id: PLAN_ID, updatedAt: EARLIER, deleted: false, value: row }],
      ACCOUNT,
    );
    expect(await repository.plans.list()).toEqual([]);
  });

  test("an order whose plan is gone is not listed", async () => {
    const repository = await create();
    await repository.sync.apply(
      [
        {
          kind: "order",
          id: orderId(1),
          updatedAt: LATER,
          deleted: false,
          value: { ...order(1), planId: PLAN_ID, position: 0, updatedAt: LATER },
        },
      ],
      ACCOUNT,
    );
    expect(await repository.plans.list()).toEqual([]);
  });

  test("the same order id in two plans is two orders", async () => {
    const repository = await create();
    const other = "00000000-0000-4000-8000-000000000003";
    await repository.plans.put(plan([order(1)]));
    await repository.plans.put(plan([order(1, 2000)], EARLIER, other));
    expect((await repository.plans.get(PLAN_ID))?.orders).toEqual([order(1)]);
    expect((await repository.plans.get(other))?.orders).toEqual([order(1, 2000)]);
  });

  test("a received row that fails validation is set aside", async () => {
    const repository = await create();
    await repository.sync.apply(
      [{ kind: "shop", id: SHOP_ID, updatedAt: LATER, deleted: false, value: { id: SHOP_ID } }],
      ACCOUNT,
    );
    expect(await repository.shops.list()).toEqual([]);
    expect(await repository.quarantined()).toBe(1);
  });

  test("markAllPending marks every row and every removal", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)]));
    await repository.plans.put(plan([], EARLIER, "00000000-0000-4000-8000-000000000003"));
    await repository.plans.delete("00000000-0000-4000-8000-000000000003");
    await repository.profile.put({ updatedAt: EARLIER });
    await repository.sync.acknowledge(await repository.sync.pending());
    await repository.sync.markAllPending();
    expect(keys(await repository.sync.pending())).toEqual([
      `order:${orderId(1)}:false`,
      "plan:00000000-0000-4000-8000-000000000001:false",
      "plan:00000000-0000-4000-8000-000000000003:true",
      "profile:profile:false",
    ]);
  });

  test("rows received after the device stopped syncing are not written", async () => {
    const repository = await create();
    await repository.sync.meta.put(undefined);
    const { orders: _, ...row } = plan([]);
    expect(
      await repository.sync.apply(
        [{ kind: "plan", id: PLAN_ID, updatedAt: LATER, deleted: false, value: row }],
        ACCOUNT,
      ),
    ).toBe(false);
    expect(await repository.plans.list()).toEqual([]);
  });

  test("an order received while the plan is being changed is kept", async () => {
    const repository = await create();
    await repository.plans.put(plan([order(1)]));
    const received = { ...order(2), planId: PLAN_ID, position: 1, updatedAt: LATER };
    await Promise.all([
      repository.plans.update(PLAN_ID, (stored) => ({
        ...stored!,
        name: "renamed",
        updatedAt: LATER,
      })),
      repository.sync.apply(
        [{ kind: "order", id: orderId(2), updatedAt: LATER, deleted: false, value: received }],
        ACCOUNT,
      ),
    ]);
    const stored = await repository.plans.get(PLAN_ID);
    expect(stored?.name).toBe("renamed");
    expect(stored?.orders).toEqual([order(1), order(2)]);
  });

  test("clear forgets the sync settings", async () => {
    const repository = await create();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
    ]);
    await repository.sync.meta.put({ accountId: "a", cursor: 3, encryptionKey: key, idKey: key });
    expect((await repository.sync.meta.get())?.cursor).toBe(3);
    await repository.clear();
    expect(await repository.sync.meta.get()).toBeUndefined();
  });
});
