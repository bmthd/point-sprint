import "fake-indexeddb/auto";
import type { Plan, Profile, Shop } from "@workspaces/domain";
import { expect, test, vi } from "vitest";
import { createIndexedDbRepository } from "./indexed-db-repository";

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
const profile: Profile = { spuBenefits: [], updatedAt: now };

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
        to: 2,
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
    migrations: [{ to: 2, stores: { plans: (row) => ({ ...(row as Plan), name: "migrated" }) } }],
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
