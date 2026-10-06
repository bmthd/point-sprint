import "fake-indexeddb/auto";
import type { Plan, Profile, Shop } from "@workspaces/domain";
import { expect, test } from "vitest";
import { createIndexedDbRepository } from "./indexed-db-repository";
import { createMemoryRepository } from "./memory-repository";
import type { Repository } from "./repository";

const now = "2026-10-05T00:00:00.000Z";
const planA: Plan = {
  id: "00000000-0000-4000-8000-00000000000a",
  name: "A",
  period: { start: "2026-10-04", end: "2026-10-11" },
  benefits: [],
  orders: [],
  updatedAt: now,
};
const planB: Plan = { ...planA, id: "00000000-0000-4000-8000-00000000000b", name: "B" };
// Omits `tags` so both implementations must apply the schema default.
const shop = {
  id: "00000000-0000-4000-8000-000000000002",
  channel: "rakuten-ichiba",
  name: "ショップA",
  updatedAt: now,
} as Shop;
const profile: Profile = { spuBenefits: [], updatedAt: now };

async function scenario(repo: Repository) {
  await repo.plans.put(planB);
  await repo.plans.put(planA);
  await repo.plans.put({ ...planA, name: "A2" });
  await repo.shops.put(shop);
  await repo.profile.put(profile);
  const invalidPut = await repo.plans.put({ ...planA, id: "x" }).then(
    () => "resolved",
    () => "rejected",
  );
  const afterPuts = {
    plans: await repo.plans.list(),
    planA: await repo.plans.get(planA.id),
    missing: await repo.plans.get("00000000-0000-4000-8000-0000000000ff"),
    shops: await repo.shops.list(),
    profile: await repo.profile.get(),
  };
  await repo.plans.delete(planB.id);
  return {
    invalidPut,
    afterPuts,
    afterDelete: await repo.plans.list(),
    quarantined: await repo.quarantined(),
    wasReset: repo.wasReset(),
  };
}

test("memory repository behaves like the IndexedDB one", async () => {
  const fromMemory = await scenario(createMemoryRepository());
  const fromIndexedDb = await scenario(createIndexedDbRepository({ name: "memory-contract" }));

  expect(fromMemory).toEqual(fromIndexedDb);
  expect(fromMemory.invalidPut).toBe("rejected");
  expect(fromMemory.afterPuts.plans.map((p) => p.name)).toEqual(["A2", "B"]);
  expect(fromMemory.afterPuts.shops[0]?.tags).toEqual([]);
});

test("memory repository starts from the initial data and does not share references", async () => {
  const repo = createMemoryRepository({ plans: [planA], shops: [shop], profile });

  const listed = await repo.plans.list();
  listed[0]!.name = "changed";

  expect(await repo.plans.get(planA.id)).toEqual(planA);
  expect(await repo.profile.get()).toEqual(profile);
  expect(await repo.shops.list()).toHaveLength(1);
});
