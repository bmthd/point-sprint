import "fake-indexeddb/auto";
import {
  BOOKS_SPU_ID,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_ACCOUNT_ID,
  type Plan,
  type Profile,
  type Shop,
  standardSpu,
} from "@workspaces/domain";
import { expect, test, vi } from "vitest";
import { createIndexedDbRepository } from "./indexed-db-repository";
import { OutdatedDatabaseError } from "./repository";

const now = "2026-10-05T00:00:00.000Z";
const plan: Plan = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-11" },
  benefits: [],
  orders: [],
  updatedAt: now,
};
const shop: Shop = {
  id: "00000000-0000-4000-8000-000000000002",
  channel: "rakuten-ichiba",
  name: "ショップA",
  tags: [],
  updatedAt: now,
};
const profile: Profile = { updatedAt: now };

let counter = 0;
const uniqueName = () => `test-${Date.now()}-${counter++}`;

function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// The repository refuses invalid rows, so write one through a plain IndexedDB connection to the
// same database (call after the repository has created its stores).
async function putRaw(name: string, store: string, row: unknown): Promise<void> {
  const raw = await openRaw(name);
  await new Promise<void>((resolve, reject) => {
    const tx = raw.transaction(store, "readwrite");
    tx.objectStore(store).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  raw.close();
}

async function countRaw(name: string, store: string): Promise<number> {
  const raw = await openRaw(name);
  const count = await new Promise<number>((resolve, reject) => {
    const request = raw.transaction(store).objectStore(store).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  raw.close();
  return count;
}

const newerApp = (name: string) =>
  createIndexedDbRepository({ name, migrations: [{ to: CURRENT_SCHEMA_VERSION + 1, stores: {} }] });

test("round-trips plans, shops and profile", async () => {
  const repo = createIndexedDbRepository({ name: uniqueName() });

  expect(await repo.plans.list()).toEqual([]);
  expect(await repo.plans.get(plan.id)).toBeUndefined();
  expect(await repo.profile.get()).toBeUndefined();

  await repo.plans.put(plan);
  await repo.shops.put(shop);
  await repo.profile.put(profile);

  expect(await repo.plans.list()).toEqual([plan]);
  expect(await repo.plans.get(plan.id)).toEqual(plan);
  expect(await repo.shops.list()).toEqual([shop]);
  expect(await repo.profile.get()).toEqual(profile);

  await repo.plans.delete(plan.id);
  expect(await repo.plans.list()).toEqual([]);
  expect(await repo.quarantined()).toBe(0);
  expect(repo.wasReset()).toBe(false);
});

test("put rejects an invalid plan", async () => {
  const repo = createIndexedDbRepository({ name: uniqueName() });

  await expect(repo.plans.put({ ...plan, id: "not-a-uuid" })).rejects.toThrow();
  expect(await repo.plans.list()).toEqual([]);
});

test("invalid stored rows are quarantined and skipped", async () => {
  const name = uniqueName();
  const repo = createIndexedDbRepository({ name });
  await repo.plans.put(plan);

  await putRaw(name, "plans", { id: "broken", name: 1 });

  expect(await repo.plans.list()).toEqual([plan]);
  expect(await repo.plans.get("broken")).toBeUndefined();
  expect(await repo.quarantined()).toBe(1);
});

test("a failed migration deletes and recreates the database", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const name = uniqueName();
  await createIndexedDbRepository({ name }).plans.put(plan);

  const repo = createIndexedDbRepository({
    name,
    migrations: [
      {
        to: CURRENT_SCHEMA_VERSION + 1,
        stores: {
          plans: () => {
            throw new Error("broken migration");
          },
        },
      },
    ],
  });

  expect(await repo.plans.list()).toEqual([]);
  expect(repo.wasReset()).toBe(true);
  await repo.plans.put(plan);
  expect(await repo.plans.list()).toEqual([plan]);
  warn.mockRestore();
});

test("concurrent reads quarantine a bad row once", async () => {
  const name = uniqueName();
  const repo = createIndexedDbRepository({ name });
  await repo.plans.put(plan);
  await putRaw(name, "plans", { id: "broken", name: 1 });

  const [listed, got] = await Promise.all([repo.plans.list(), repo.plans.get("broken")]);

  expect(listed).toEqual([plan]);
  expect(got).toBeUndefined();
  expect(await repo.quarantined()).toBe(1);
});

test("a migration rewrites stored rows", async () => {
  const name = uniqueName();
  await createIndexedDbRepository({ name }).plans.put(plan);

  const repo = createIndexedDbRepository({
    name,
    migrations: [
      {
        to: CURRENT_SCHEMA_VERSION + 1,
        stores: { plans: (row) => ({ ...(row as Plan), name: "migrated" }) },
      },
    ],
  });

  expect(await repo.plans.list()).toEqual([{ ...plan, name: "migrated" }]);
  expect(repo.wasReset()).toBe(false);
});

test("a failure to open that is not a migration keeps the data and retries", async () => {
  const name = uniqueName();
  await createIndexedDbRepository({ name }).plans.put(plan);

  const repo = createIndexedDbRepository({ name });
  const open = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
    throw new DOMException("disk unavailable", "UnknownError");
  });

  await expect(repo.plans.list()).rejects.toThrow();
  open.mockRestore();
  expect(repo.wasReset()).toBe(false);
  expect(await repo.plans.list()).toEqual([plan]);
});

test("a valid row written while a bad one is being moved is kept", async () => {
  const name = uniqueName();
  const repo = createIndexedDbRepository({ name });
  await repo.plans.list();
  await putRaw(name, "plans", { id: plan.id, name: 1 });

  // The list sees the bad row; the put replaces it before the move to `quarantine` runs.
  await Promise.all([repo.plans.list(), repo.plans.put(plan)]);

  expect(await repo.plans.get(plan.id)).toEqual(plan);
  expect(await repo.quarantined()).toBe(0);
});

test("quarantined rows can be listed and removed one at a time or all at once", async () => {
  const name = uniqueName();
  const repo = createIndexedDbRepository({ name });
  await repo.quarantined(); // creates the stores
  await putRaw(name, "plans", { id: "broken-1", name: 1 });
  await putRaw(name, "plans", { id: "broken-2", name: 2 });
  await repo.plans.list();

  const rows = await repo.quarantine.list();
  expect(rows.map((row) => [row.store, row.value])).toEqual([
    ["plans", { id: "broken-1", name: 1 }],
    ["plans", { id: "broken-2", name: 2 }],
  ]);
  expect(rows[0]?.issues.length).toBeGreaterThan(0);

  await repo.quarantine.delete(rows[0]!.key);
  expect((await repo.quarantine.list()).map((row) => row.value)).toEqual([
    { id: "broken-2", name: 2 },
  ]);

  await repo.quarantine.clear();
  expect(await repo.quarantined()).toBe(0);
});

test("clear removes every stored row, including the quarantined ones", async () => {
  const name = uniqueName();
  const repo = createIndexedDbRepository({ name });
  await repo.plans.put(plan);
  await repo.shops.put(shop);
  await repo.profile.put(profile);
  await repo.spuMonths.put({
    id: `${DEFAULT_ACCOUNT_ID}:2026-10`,
    accountId: DEFAULT_ACCOUNT_ID,
    month: "2026-10",
    enabledIds: [],
    updatedAt: now,
  });
  await putRaw(name, "plans", { id: "broken", name: 1 });
  await repo.plans.list();

  await repo.clear();

  expect(await repo.spuMonths.list()).toEqual([]);
  expect(await repo.plans.list()).toEqual([]);
  expect(await repo.shops.list()).toEqual([]);
  expect(await repo.profile.get()).toBeUndefined();
  expect(await repo.quarantined()).toBe(0);
});

test("an app older than the database stops reading and writing, and keeps the rows", async () => {
  const name = uniqueName();
  await newerApp(name).plans.put(plan);
  // A row in a shape only the newer app knows.
  await putRaw(name, "plans", { id: "future", name: 1 });

  const older = createIndexedDbRepository({ name });

  await expect(older.plans.list()).rejects.toBeInstanceOf(OutdatedDatabaseError);
  await expect(older.plans.put({ ...plan, name: "old" })).rejects.toBeInstanceOf(
    OutdatedDatabaseError,
  );
  expect(await countRaw(name, "plans")).toBe(2);
  expect(await countRaw(name, "quarantine")).toBe(0);
});

test("an open app stops once a newer app upgrades the database", async () => {
  const name = uniqueName();
  const older = createIndexedDbRepository({ name });
  await older.plans.put(plan);

  await newerApp(name).plans.list();

  await expect(older.plans.list()).rejects.toBeInstanceOf(OutdatedDatabaseError);
});

test("opening a version 9 database moves each plan's SPU to the month's SPU", async () => {
  const name = uniqueName();
  const raw = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 9);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("plans", { keyPath: "id" });
      db.createObjectStore("shops", { keyPath: "id" });
      db.createObjectStore("profile");
      db.createObjectStore("quarantine", { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = raw.transaction(["plans", "profile"], "readwrite");
    const spu = standardSpu.map((benefit) => ({
      ...benefit,
      enabled: benefit.id === BOOKS_SPU_ID,
    }));
    tx.objectStore("plans").put({ ...plan, benefits: spu });
    tx.objectStore("profile").put({ spuBenefits: spu, updatedAt: now }, "profile");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  raw.close();

  const repo = createIndexedDbRepository({ name });

  expect(await repo.plans.list()).toEqual([plan]);
  expect(await repo.profile.get()).toEqual(profile);
  expect(await repo.spuMonths.list()).toEqual([
    {
      id: `${DEFAULT_ACCOUNT_ID}:2026-10`,
      accountId: DEFAULT_ACCOUNT_ID,
      month: "2026-10",
      enabledIds: [BOOKS_SPU_ID],
      updatedAt: now,
    },
  ]);
  expect(repo.wasReset()).toBe(false);
});

test("opening a version 10 database moves each plan's orders to rows of their own", async () => {
  const name = uniqueName();
  const raw = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 10);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("plans", { keyPath: "id" });
      db.createObjectStore("shops", { keyPath: "id" });
      db.createObjectStore("profile");
      db.createObjectStore("spuMonths", { keyPath: "id" });
      db.createObjectStore("quarantine", { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const order = (id: string) => ({
    id,
    date: "2026-10-05",
    lineItems: [
      {
        id: crypto.randomUUID(),
        name: "item",
        unitPrice: 1000,
        quantity: 1,
        taxRate: 0.1,
        discount: 0,
      },
    ],
    onHold: false,
    tags: [],
    shopId: shop.id,
  });
  const orders = [
    order("00000000-0000-4000-8000-000000000012"),
    order("00000000-0000-4000-8000-000000000011"),
  ];
  await new Promise<void>((resolve, reject) => {
    const tx = raw.transaction(["plans"], "readwrite");
    tx.objectStore("plans").put({ ...plan, orders });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  raw.close();

  const repo = createIndexedDbRepository({ name });

  expect(await repo.plans.list()).toEqual([{ ...plan, orders }]);
  expect(await countRaw(name, "orders")).toBe(2);
  expect(repo.wasReset()).toBe(false);
});
