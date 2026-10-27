import {
  CURRENT_SCHEMA_VERSION,
  type Order,
  type Plan,
  type SyncRow,
  orderRowId,
} from "@workspaces/domain";
import { describe, expect, test } from "vitest";
import { createMemoryRepository } from "./memory-repository";
import { encryptRow } from "./sync-crypto";
import { createSyncRunner, syncOnce } from "./sync-engine";
import { signIn, startSync } from "./sync-passkey";
import { createTestBackend, createTestPasskeys, prfOutput } from "./sync-test-server";

const PLAN_ID = "00000000-0000-4000-8000-000000000001";
const SHOP_ID = "00000000-0000-4000-8000-000000000002";

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

const plan = (orders: Order[], updatedAt: string): Plan => ({
  id: PLAN_ID,
  name: "お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-11" },
  benefits: [],
  orders,
  updatedAt,
});

/** A phone and a PC logged in to the same account. */
async function twoDevices() {
  const backend = createTestBackend();
  const passkeys = createTestPasskeys();
  const device = () => {
    const { server } = backend.device();
    const repository = createMemoryRepository();
    return {
      repository,
      server,
      passkeys: passkeys.device((id) => prfOutput(id)),
      sync: () => syncOnce({ repository, server, version: CURRENT_SCHEMA_VERSION }),
    };
  };
  const phone = device();
  const pc = device();
  await phone.repository.plans.put(plan([order(1), order(2)], "2026-10-05T00:00:00.000Z"));
  await startSync(phone, "token");
  await phone.sync();
  await signIn(pc);
  await pc.sync();
  return { phone, pc };
}

const ordersOf = async (repository: ReturnType<typeof createMemoryRepository>) =>
  (await repository.plans.get(PLAN_ID))?.orders;

describe("syncOnce", () => {
  test("a device that logs in gets the other device's data", async () => {
    const { pc } = await twoDevices();
    expect(await ordersOf(pc.repository)).toEqual([order(1), order(2)]);
  });

  test("an order added on one device and another edited on the other are both kept", async () => {
    const { phone, pc } = await twoDevices();
    await pc.repository.plans.put(plan([order(1), order(2), order(3)], "2026-10-06T00:00:00.000Z"));
    await phone.repository.plans.put(plan([order(1, 5000), order(2)], "2026-10-06T01:00:00.000Z"));
    await pc.sync();
    await phone.sync();
    await pc.sync();
    const expected = [order(1, 5000), order(2), order(3)];
    expect(await ordersOf(phone.repository)).toEqual(expected);
    expect(await ordersOf(pc.repository)).toEqual(expected);
  });

  test("the same order edited on both devices ends as the later edit on both", async () => {
    const { phone, pc } = await twoDevices();
    await phone.repository.plans.put(plan([order(1, 3000), order(2)], "2026-10-06T02:00:00.000Z"));
    await pc.repository.plans.put(plan([order(1, 4000), order(2)], "2026-10-06T01:00:00.000Z"));
    await phone.sync();
    await pc.sync();
    await phone.sync();
    expect(await ordersOf(phone.repository)).toEqual([order(1, 3000), order(2)]);
    expect(await ordersOf(pc.repository)).toEqual([order(1, 3000), order(2)]);
  });

  test("a plan removed on one device does not come back from the other", async () => {
    const { phone, pc } = await twoDevices();
    await phone.repository.plans.delete(PLAN_ID);
    await phone.sync();
    await pc.sync();
    await phone.sync();
    expect(await pc.repository.plans.list()).toEqual([]);
    expect(await phone.repository.plans.list()).toEqual([]);
  });

  test("a row of a newer version stops the round and writes nothing", async () => {
    const { phone, pc } = await twoDevices();
    const meta = (await phone.repository.sync.meta.get())!;
    const newer: SyncRow = {
      kind: "order",
      id: orderRowId(PLAN_ID, order(1).id),
      updatedAt: "2026-10-09T00:00:00.000Z",
      deleted: false,
      value: {
        ...order(1, 9999),
        planId: PLAN_ID,
        position: 0,
        updatedAt: "2026-10-09T00:00:00.000Z",
      },
    };
    await phone.server.push({
      records: [await encryptRow(meta, newer, CURRENT_SCHEMA_VERSION + 1)],
    });
    expect(await pc.sync()).toEqual({ status: "outdated" });
    expect(await ordersOf(pc.repository)).toEqual([order(1), order(2)]);
  });

  test("rows that could not be sent are sent next round", async () => {
    const { phone, pc } = await twoDevices();
    await phone.repository.plans.put(plan([order(1), order(2, 7000)], "2026-10-06T00:00:00.000Z"));
    const failing = {
      pull: phone.server.pull,
      push: async () => ({ ok: false, reason: "rate" }) as const,
    };
    expect(
      await syncOnce({
        repository: phone.repository,
        server: failing,
        version: CURRENT_SCHEMA_VERSION,
      }),
    ).toEqual({ status: "refused", reason: "rate" });
    await phone.sync();
    await pc.sync();
    expect(await ordersOf(pc.repository)).toEqual([order(1), order(2, 7000)]);
  });

  test("a device that does not sync does nothing", async () => {
    const repository = createMemoryRepository();
    const { server } = createTestBackend().device();
    expect(await syncOnce({ repository, server, version: CURRENT_SCHEMA_VERSION })).toEqual({
      status: "off",
    });
  });
});

describe("createSyncRunner", () => {
  test("a request during a round runs one more round after it", async () => {
    let rounds = 0;
    let release!: () => void;
    const runner = createSyncRunner(
      () =>
        new Promise<number>((resolve) => {
          rounds += 1;
          release = () => resolve(rounds);
        }),
      () => {},
    );
    const first = runner.request();
    runner.request();
    runner.request();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await first;
    expect(rounds).toBe(2);
  });
});
