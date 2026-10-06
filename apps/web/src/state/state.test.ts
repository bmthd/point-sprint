import {
  type Order,
  type Plan,
  type Profile,
  type Shop,
  standardSpu,
  toggleBenefits,
} from "@workspaces/domain";
import { QueryClient } from "@tanstack/query-core";
import { createStore } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, expect, test, vi } from "vitest";
import { createMemoryRepository } from "../storage/memory-repository";
import type { Repository } from "../storage/repository";
import { calculationAtom, orderAtom, orderPointsAtom } from "./derived";
import { changeShop, replacePlan, saveProfileAtom, savePlanAtom, saveShopAtom } from "./mutations";
import { copyOrderAtom, updateOrderAtom } from "./order-ops";
import { plansAtom, profileAtom, queryKeys, shopsAtom } from "./queries";
import { repositoryAtom } from "./repository";

const now = "2026-10-05T00:00:00.000Z";
const SHOP = "a0000000-0000-4000-8000-000000000001";
const PLAN = "f0000000-0000-4000-8000-000000000001";
const ORDER_A = "0a000000-0000-4000-8000-000000000000";
const ORDER_B = "0b000000-0000-4000-8000-000000000000";

const shop: Shop = {
  id: SHOP,
  channel: "rakuten-ichiba",
  name: "ショップ",
  tags: [],
  updatedAt: now,
};

const order = (id: string, unitPrice: number): Order => ({
  id,
  shopId: SHOP,
  date: "2026-10-05",
  lineItems: [
    {
      id: `${id.slice(0, 2)}000000-0000-4000-8000-000000000001`,
      name: "item",
      unitPrice,
      quantity: 1,
      taxRate: 0,
      discount: 0,
      shopPointRate: 2,
    },
  ],
  onHold: false,
  tags: [],
});

const plan: Plan = {
  id: PLAN,
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: [order(ORDER_A, 1000)],
  updatedAt: now,
};

const unsubscribes: (() => void)[] = [];
afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
});

function setup(repository: Repository = createMemoryRepository({ plans: [plan], shops: [shop] })) {
  const store = createStore();
  store.set(queryClientAtom, new QueryClient());
  store.set(repositoryAtom, repository);
  unsubscribes.push(
    store.sub(plansAtom, () => {}),
    store.sub(shopsAtom, () => {}),
  );
  return store;
}

type Store = ReturnType<typeof setup>;

const loaded = (store: Store) => vi.waitFor(() => expect(store.get(plansAtom)).toHaveLength(1));

/**
 * Wraps the memory repository so that `plans.put` waits for the test to settle it, and so that
 * `plans.list` can be made to never answer, which keeps a fetch after a save from changing the cache.
 */
function controlled(base: Repository) {
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  let listsHang = false;
  const repository: Repository = {
    ...base,
    plans: {
      ...base.plans,
      list: () => (listsHang ? new Promise<Plan[]>(() => {}) : base.plans.list()),
      put: (next) =>
        new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: () => base.plans.put(next).then(resolve, reject),
            reject,
          });
        }),
    },
  };
  const hangLists = () => {
    listsHang = true;
  };
  return { repository, pending, hangLists };
}

const cachedPlan = (store: Store) =>
  store
    .get(queryClientAtom)
    .getQueryData<Plan[]>(queryKeys.plans)
    ?.find((p) => p.id === PLAN);

test("savePlan updates the cache before the repository resolves", async () => {
  const { repository, pending } = controlled(
    createMemoryRepository({ plans: [plan], shops: [shop] }),
  );
  const store = setup(repository);
  await loaded(store);

  const saved = store.get(savePlanAtom).mutateAsync(replacePlan({ ...plan, name: "renamed" }));
  await vi.waitFor(() => expect(store.get(plansAtom)[0]?.name).toBe("renamed"));
  expect(pending).toHaveLength(1);
  expect(await repository.plans.get(PLAN)).toMatchObject({ name: "plan" });

  pending[0]?.resolve();
  await saved;
  const stored = await repository.plans.get(PLAN);
  expect(stored).toMatchObject({ name: "renamed" });
  expect(stored?.updatedAt).not.toBe(now);
  expect(cachedPlan(store)?.updatedAt).toBe(stored?.updatedAt);
});

test("failed save rolls back", async () => {
  const { repository, pending, hangLists } = controlled(
    createMemoryRepository({ plans: [plan], shops: [shop] }),
  );
  const store = setup(repository);
  await loaded(store);

  const saved = store.get(savePlanAtom).mutateAsync(replacePlan({ ...plan, name: "renamed" }));
  await vi.waitFor(() => expect(cachedPlan(store)?.name).toBe("renamed"));
  hangLists();
  pending[0]?.reject(new Error("disk full"));
  await expect(saved).rejects.toThrow("disk full");
  expect(cachedPlan(store)?.name).toBe("plan");
});

test("a failed operation is left out while an overlapping one is kept", async () => {
  const { repository, pending } = controlled(
    createMemoryRepository({
      plans: [{ ...plan, orders: [order(ORDER_A, 1000), order(ORDER_B, 2000)] }],
      shops: [shop],
    }),
  );
  const store = setup(repository);
  await loaded(store);
  const priceOf = (p: Plan | undefined, orderId: string) =>
    p?.orders.find((o) => o.id === orderId)?.lineItems[0]?.unitPrice;

  const first = store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_A, 3000) });
  const second = store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_B, 5000) });
  await vi.waitFor(() => expect(priceOf(cachedPlan(store), ORDER_B)).toBe(5000));
  expect(priceOf(cachedPlan(store), ORDER_A)).toBe(3000);
  expect(pending).toHaveLength(1);

  pending[0]?.reject(new Error("disk full"));
  await expect(first).rejects.toThrow("disk full");
  expect(priceOf(cachedPlan(store), ORDER_B)).toBe(5000);

  await vi.waitFor(() => expect(pending).toHaveLength(2));
  pending[1]?.resolve();
  await second;
  const stored = await repository.plans.get(PLAN);
  expect(priceOf(stored, ORDER_A)).toBe(1000);
  expect(priceOf(stored, ORDER_B)).toBe(5000);
  await vi.waitFor(() => expect(priceOf(cachedPlan(store), ORDER_A)).toBe(1000));
  expect(priceOf(cachedPlan(store), ORDER_B)).toBe(5000);
});

test("order atom keeps identity when another order changes", async () => {
  const store = setup(
    createMemoryRepository({
      plans: [{ ...plan, orders: [order(ORDER_A, 1000), order(ORDER_B, 2000)] }],
      shops: [shop],
    }),
  );
  await loaded(store);
  const orderB = orderAtom({ planId: PLAN, orderId: ORDER_B });
  expect(orderAtom({ planId: PLAN, orderId: ORDER_B })).toBe(orderB);
  unsubscribes.push(store.sub(orderB, () => {}));
  const before = store.get(orderB);
  expect(before?.id).toBe(ORDER_B);

  await store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_A, 3000) });
  await vi.waitFor(() =>
    expect(store.get(orderAtom({ planId: PLAN, orderId: ORDER_A }))?.lineItems[0]?.unitPrice).toBe(
      3000,
    ),
  );
  expect(store.get(orderB)).toBe(before);
});

test("calculation reflects saved orders", async () => {
  const store = setup();
  await loaded(store);
  await vi.waitFor(() => expect(store.get(calculationAtom).get(PLAN)?.total).toBe(10));

  await store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_A, 3000) });
  await vi.waitFor(() => expect(store.get(calculationAtom).get(PLAN)?.total).toBe(30));
});

test("order points atom keeps identity when another order changes", async () => {
  const store = setup(
    createMemoryRepository({
      plans: [{ ...plan, orders: [order(ORDER_A, 1000), order(ORDER_B, 2000)] }],
      shops: [shop],
    }),
  );
  await loaded(store);
  const pointsA = orderPointsAtom({ planId: PLAN, orderId: ORDER_A });
  const pointsB = orderPointsAtom({ planId: PLAN, orderId: ORDER_B });
  expect(orderPointsAtom({ planId: PLAN, orderId: ORDER_A })).toBe(pointsA);
  unsubscribes.push(
    store.sub(pointsA, () => {}),
    store.sub(pointsB, () => {}),
  );
  await vi.waitFor(() => expect(store.get(pointsB).total).toBe(20));
  const before = store.get(pointsA);
  expect(before.total).toBe(10);
  expect(before.rows).toHaveLength(1);

  await store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_B, 5000) });
  await vi.waitFor(() => expect(store.get(pointsB).total).toBe(50));
  expect(store.get(pointsA)).toBe(before);
});

test("copy inserts the order right after the original", async () => {
  const { repository, pending, hangLists } = controlled(
    createMemoryRepository({
      plans: [{ ...plan, orders: [order(ORDER_A, 1000), order(ORDER_B, 2000)] }],
      shops: [shop],
    }),
  );
  const store = setup(repository);
  await loaded(store);

  const copied = store.set(copyOrderAtom, { planId: PLAN, orderId: ORDER_A });
  await vi.waitFor(() => expect(cachedPlan(store)?.orders).toHaveLength(3));
  const ids = (cachedPlan(store)?.orders ?? []).map((o) => o.id);
  expect(ids[0]).toBe(ORDER_A);
  expect(ids[1]).not.toBe(ORDER_A);
  expect(ids[2]).toBe(ORDER_B);

  hangLists();
  pending[0]?.resolve();
  await copied;
  const stored = await repository.plans.get(PLAN);
  expect(stored?.orders).toEqual(cachedPlan(store)?.orders);
});

/** Makes `put` wait for the test to settle it, like `controlled` does for plans. */
function heldPuts<T>(put: (value: T) => Promise<void>) {
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const held = (value: T) =>
    new Promise<void>((resolve, reject) => {
      pending.push({ resolve: () => put(value).then(resolve, reject), reject });
    });
  return { held, pending };
}

test("a failed shop change is left out while an overlapping one is kept", async () => {
  const base = createMemoryRepository({ plans: [plan], shops: [shop] });
  const { held, pending } = heldPuts(base.shops.put);
  const store = setup({ ...base, shops: { ...base.shops, put: held } });
  await loaded(store);
  await vi.waitFor(() => expect(store.get(shopsAtom)).toHaveLength(1));

  const save = store.get(saveShopAtom).mutateAsync;
  const first = save(changeShop(SHOP, (current) => ({ ...current, name: "renamed" })));
  const second = save(changeShop(SHOP, (current) => ({ ...current, tags: ["39shop"] })));
  await vi.waitFor(() => expect(store.get(shopsAtom)[0]?.tags).toEqual(["39shop"]));
  expect(store.get(shopsAtom)[0]?.name).toBe("renamed");

  pending[0]?.reject(new Error("disk full"));
  await expect(first).rejects.toThrow("disk full");
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  pending[1]?.resolve();
  await second;
  expect(await base.shops.list()).toMatchObject([{ name: "ショップ", tags: ["39shop"] }]);
  await vi.waitFor(() =>
    expect(store.get(shopsAtom)).toMatchObject([{ name: "ショップ", tags: ["39shop"] }]),
  );
});

test("a failed profile change is left out while an overlapping one is kept", async () => {
  const [a, b] = standardSpu
    .filter((benefit) => benefit.exclusiveGroup === undefined)
    .map((benefit) => benefit.id);
  if (!a || !b) throw new Error("standardSpu needs two benefits");
  const profile: Profile = { spuBenefits: structuredClone(standardSpu), updatedAt: now };
  const enabled = (p: Profile | undefined, id: string) =>
    p?.spuBenefits.find((benefit) => benefit.id === id)?.enabled;
  const base = createMemoryRepository({ plans: [plan], shops: [shop], profile });
  const { held, pending } = heldPuts(base.profile.put);
  const store = setup({ ...base, profile: { ...base.profile, put: held } });
  unsubscribes.push(store.sub(profileAtom, () => {}));
  await vi.waitFor(() => expect(store.get(profileAtom).updatedAt).toBe(now));

  const save = store.get(saveProfileAtom).mutateAsync;
  const toggle = (id: string) => ({
    change: (current: Profile) => ({
      ...current,
      spuBenefits: toggleBenefits(current.spuBenefits, id),
    }),
  });
  const first = save(toggle(a));
  const second = save(toggle(b));
  await vi.waitFor(() => expect(enabled(store.get(profileAtom), b)).toBe(!enabled(profile, b)));
  expect(enabled(store.get(profileAtom), a)).toBe(!enabled(profile, a));

  pending[0]?.reject(new Error("disk full"));
  await expect(first).rejects.toThrow("disk full");
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  pending[1]?.resolve();
  await second;
  const stored = await base.profile.get();
  expect(enabled(stored, a)).toBe(enabled(profile, a));
  expect(enabled(stored, b)).toBe(!enabled(profile, b));
  await vi.waitFor(() => expect(enabled(store.get(profileAtom), a)).toBe(enabled(profile, a)));
  expect(enabled(store.get(profileAtom), b)).toBe(!enabled(profile, b));
});
