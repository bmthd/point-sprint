import {
  type Benefit,
  defaultAccount,
  type Order,
  type Plan,
  type Profile,
  type Shop,
  BOOKS_SPU_ID,
  DEFAULT_ACCOUNT_ID,
  spuIdsIn,
  toggleSpu,
} from "@workspaces/domain";
import { QueryClient } from "@tanstack/query-core";
import { createStore } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, expect, test, vi } from "vitest";
import { createMemoryRepository } from "../storage/memory-repository";
import type { Repository } from "../storage/repository";
import { calculationAtom, orderAtom, orderPointsAtom } from "./derived";
import {
  changeShop,
  replacePlan,
  replaceShop,
  saveProfileAtom,
  savePlanAtom,
  saveShopAtom,
  saveSpuMonthAtom,
} from "./mutations";
import { addOrderAtom, copyOrderAtom, saveOrderDraftAtom, updateOrderAtom } from "./order-ops";
import { plansAtom, profileAtom, queryKeys, shopsAtom, spuMonthsAtom } from "./queries";
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

const order = (id: string, unitPrice: number, shopId = SHOP): Order => ({
  id,
  shopId,
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
 * Wraps the memory repository so that `plans.update` waits for the test to settle it, and so that
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
      update: (id, change, shop) =>
        new Promise((resolve, reject) => {
          pending.push({
            resolve: () => base.plans.update(id, change, shop).then(resolve, reject),
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

const NEW_SHOP = "a0000000-0000-4000-8000-000000000002";
const newShop: Shop = { ...shop, id: NEW_SHOP, name: "新しいショップ" };
const newShopDraft = (id: string) => ({
  order: order(id, 3000, NEW_SHOP),
  shopChange: replaceShop(newShop),
});

test("an order is saved with its new shop", async () => {
  const repository = createMemoryRepository({ plans: [plan], shops: [shop] });
  const store = setup(repository);
  await loaded(store);

  await store.set(saveOrderDraftAtom, { planId: PLAN, draft: newShopDraft(ORDER_B), isNew: true });
  expect((await repository.shops.list()).map((s) => s.id)).toEqual([SHOP, NEW_SHOP]);
  expect((await repository.plans.get(PLAN))?.orders.map((o) => o.id)).toEqual([ORDER_A, ORDER_B]);
  await vi.waitFor(() => expect(store.get(shopsAtom).map((s) => s.id)).toEqual([SHOP, NEW_SHOP]));
});

test("an order that fails to save leaves no new shop behind", async () => {
  const { repository, pending, hangLists } = controlled(
    createMemoryRepository({ plans: [plan], shops: [shop] }),
  );
  const store = setup(repository);
  await loaded(store);

  const saved = store.set(saveOrderDraftAtom, {
    planId: PLAN,
    draft: newShopDraft(ORDER_B),
    isNew: true,
  });
  await vi.waitFor(() => expect(store.get(shopsAtom)).toHaveLength(2));
  hangLists();
  pending[0]?.reject(new Error("disk full"));
  await expect(saved).rejects.toThrow("disk full");
  expect(await repository.shops.list()).toEqual([shop]);
  expect(cachedPlan(store)?.orders.map((o) => o.id)).toEqual([ORDER_A]);
  await vi.waitFor(() => expect(store.get(shopsAtom).map((s) => s.id)).toEqual([SHOP]));
});

test("an edit of an order removed meanwhile saves neither the order nor its new shop", async () => {
  const repository = createMemoryRepository({ plans: [plan], shops: [shop] });
  const store = setup(repository);
  await loaded(store);

  const saved = store.set(saveOrderDraftAtom, {
    planId: PLAN,
    draft: newShopDraft(ORDER_B),
    isNew: false,
  });
  await expect(saved).rejects.toThrow(ORDER_B);
  expect(await repository.shops.list()).toEqual([shop]);
  await vi.waitFor(() => expect(store.get(shopsAtom).map((s) => s.id)).toEqual([SHOP]));
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
  // The shop's +1倍 and 通常ポイント, which every plan has.
  await vi.waitFor(() => expect(store.get(calculationAtom).get(PLAN)?.total).toBe(20));

  await store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_A, 3000) });
  await vi.waitFor(() => expect(store.get(calculationAtom).get(PLAN)?.total).toBe(60));
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
  await vi.waitFor(() => expect(store.get(pointsB).total).toBe(40));
  const before = store.get(pointsA);
  expect(before.total).toBe(20);
  expect(before.rows).toHaveLength(2);

  await store.set(updateOrderAtom, { planId: PLAN, order: order(ORDER_B, 5000) });
  await vi.waitFor(() => expect(store.get(pointsB).total).toBe(100));
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
  const profile: Profile = { updatedAt: now };
  const renamed = [{ ...defaultAccount(), name: "自分" }];
  const base = createMemoryRepository({ plans: [plan], shops: [shop], profile });
  const { held, pending } = heldPuts(base.profile.put);
  const store = setup({ ...base, profile: { ...base.profile, put: held } });
  unsubscribes.push(store.sub(profileAtom, () => {}));
  await vi.waitFor(() => expect(store.get(profileAtom).updatedAt).toBe(now));

  const save = store.get(saveProfileAtom).mutateAsync;
  const first = save({ change: (current) => ({ ...current, multiAccount: true }) });
  const second = save({ change: (current) => ({ ...current, accounts: renamed }) });
  await vi.waitFor(() => expect(store.get(profileAtom).accounts).toEqual(renamed));
  expect(store.get(profileAtom).multiAccount).toBe(true);

  pending[0]?.reject(new Error("disk full"));
  await expect(first).rejects.toThrow("disk full");
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  pending[1]?.resolve();
  await second;
  const stored = await base.profile.get();
  expect(stored?.multiAccount).toBeUndefined();
  expect(stored?.accounts).toEqual(renamed);
  await vi.waitFor(() => expect(store.get(profileAtom).multiAccount).toBeUndefined());
  expect(store.get(profileAtom).accounts).toEqual(renamed);
});

test("caps are shared per account once accounts are told apart", async () => {
  const SUB = "acc00000-0000-4000-8000-000000000002";
  const OTHER = "f0000000-0000-4000-8000-000000000002";
  const bonus: Benefit = {
    id: "5b000000-0000-4000-8000-000000000001",
    kind: "rate-bonus",
    category: "campaign",
    label: "bonus",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "month",
    conditions: {},
    params: { rate: 1, roundingUnit: "item", cap: 15 },
  };
  // 10 raw points of the bonus in each plan, 20 in all against a shared cap of 15.
  const first: Plan = { ...plan, benefits: [bonus] };
  const second: Plan = {
    ...plan,
    id: OTHER,
    accountId: SUB,
    benefits: [bonus],
    orders: [order(ORDER_B, 1000)],
  };
  const store = setup(createMemoryRepository({ plans: [first, second], shops: [shop] }));
  unsubscribes.push(store.sub(profileAtom, () => {}));
  await vi.waitFor(() => expect(store.get(plansAtom)).toHaveLength(2));
  const bonusTotals = () =>
    [PLAN, OTHER].map(
      (id) =>
        store
          .get(calculationAtom)
          .get(id)
          ?.benefitTotals.find((total) => total.benefitId === bonus.id)?.cappedPoints,
    );
  const sum = () => bonusTotals().reduce((a = 0, b = 0) => a + b, 0);

  // Until accounts are told apart, the second plan's account is not used.
  await vi.waitFor(() => expect(sum()).toBe(15));

  const accounts = [defaultAccount(), { id: SUB, name: "サブ" }];
  await store.get(saveProfileAtom).mutateAsync({
    change: (current) => ({ ...current, multiAccount: true, accounts }),
  });
  await vi.waitFor(() => expect(bonusTotals()).toEqual([10, 10]));

  // A deleted account's plans are calculated as the default account's.
  await store.get(saveProfileAtom).mutateAsync({
    change: (current) => ({ ...current, accounts: [defaultAccount()] }),
  });
  await vi.waitFor(() => expect(sum()).toBe(15));
});

const OTHER_PLAN = "f0000000-0000-4000-8000-000000000002";
const booksOrder = (id: string): Order => ({
  id,
  channel: "rakuten-books",
  shopTags: [],
  date: "2026-10-06",
  lineItems: [
    {
      id: `${id.slice(0, 2)}000000-0000-4000-8000-000000000002`,
      name: "本",
      unitPrice: 3300,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
});
const booksPoints = (store: Store, planId: string) =>
  store
    .get(calculationAtom)
    .get(planId)
    ?.benefitTotals.find((total) => total.benefitId === BOOKS_SPU_ID)?.cappedPoints;

test("the month's SPU is shared by every plan of the month", async () => {
  const other: Plan = { ...plan, id: OTHER_PLAN, orders: [booksOrder(ORDER_B)] };
  const first: Plan = { ...plan, orders: [booksOrder(ORDER_A)] };
  const store = setup(createMemoryRepository({ plans: [first, other], shops: [shop] }));
  unsubscribes.push(store.sub(spuMonthsAtom, () => {}));
  await vi.waitFor(() => expect(store.get(plansAtom)).toHaveLength(2));
  expect(booksPoints(store, PLAN)).toBeUndefined();

  await store.get(saveSpuMonthAtom).mutateAsync({
    accountId: DEFAULT_ACCOUNT_ID,
    month: "2026-10",
    change: (ids) => toggleSpu(ids, BOOKS_SPU_ID),
  });

  await vi.waitFor(() => expect(booksPoints(store, PLAN)).toBe(15));
  expect(booksPoints(store, OTHER_PLAN)).toBe(15);
});

test("an order that achieves an SPU turns it on for its account's month", async () => {
  const other: Plan = { ...plan, id: OTHER_PLAN, orders: [] };
  const repository = createMemoryRepository({ plans: [plan, other], shops: [shop] });
  const store = setup(repository);
  unsubscribes.push(store.sub(spuMonthsAtom, () => {}));
  await vi.waitFor(() => expect(store.get(plansAtom)).toHaveLength(2));

  await store.set(addOrderAtom, { planId: OTHER_PLAN, order: booksOrder(ORDER_B) });

  const months = await repository.spuMonths.list();
  expect(spuIdsIn(months, DEFAULT_ACCOUNT_ID, "2026-10").has(BOOKS_SPU_ID)).toBe(true);
  await vi.waitFor(() => expect(booksPoints(store, OTHER_PLAN)).toBe(15));
});

test("an SPU is achieved by what is saved, not by an earlier operation that failed", async () => {
  const other: Plan = { ...plan, id: OTHER_PLAN, orders: [] };
  const { repository, pending } = controlled(
    createMemoryRepository({ plans: [plan, other], shops: [shop] }),
  );
  const store = setup(repository);
  unsubscribes.push(store.sub(spuMonthsAtom, () => {}));
  await vi.waitFor(() => expect(store.get(plansAtom)).toHaveLength(2));

  const first = store.set(addOrderAtom, { planId: OTHER_PLAN, order: booksOrder(ORDER_A) });
  await vi.waitFor(() => expect(pending).toHaveLength(1));
  const second = store.set(addOrderAtom, { planId: OTHER_PLAN, order: booksOrder(ORDER_B) });
  pending[0]?.reject(new Error("disk full"));
  await expect(first).rejects.toThrow("disk full");
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  pending[1]?.resolve();
  await second;

  expect((await repository.plans.get(OTHER_PLAN))?.orders.map((o) => o.id)).toEqual([ORDER_B]);
  const months = await repository.spuMonths.list();
  expect(spuIdsIn(months, DEFAULT_ACCOUNT_ID, "2026-10").has(BOOKS_SPU_ID)).toBe(true);
});
