import type { Repository } from "../storage/repository";
import {
  type Plan,
  type Profile,
  type Shop,
  type SpuMonth,
  spuIdsIn,
  spuMonthId,
} from "@workspaces/domain";
import type { QueryClient } from "@tanstack/query-core";
import { atomWithMutation, queryClientAtom } from "jotai-tanstack-query";
import { defaultProfile, queryKeys } from "./queries";
import { repositoryAtom } from "./repository";

const timestamps = new WeakMap<object, string>();

/** Reuses the optimistic timestamp, advancing past the stored row when a later write won first. */
const stamp = <T extends { updatedAt: string }>(value: T, variables: object, stored?: T): T => {
  const proposed = timestamps.get(variables) ?? new Date().toISOString();
  const updatedAt =
    stored && proposed <= stored.updatedAt
      ? new Date(Date.parse(stored.updatedAt) + 1).toISOString()
      : proposed;
  timestamps.set(variables, updatedAt);
  return { ...value, updatedAt };
};

type Snapshot = { previous: unknown };

/**
 * Writes a mutation's change into the cache of one query before the repository is asked.
 * `pending` counts the pending mutations that change the query, this one included.
 *
 * - On failure the previous value comes back only when no other of those mutations is pending;
 *   the snapshot would otherwise erase that mutation's change.
 * - The query is fetched again once the last pending one settles, which also clears a failed
 *   change that could not be rolled back.
 */
function cacheChange<TData, TVariables>(
  client: QueryClient,
  queryKey: readonly ["plans"] | readonly ["shops"] | readonly ["profile"] | readonly ["spuMonths"],
  apply: (current: TData | undefined, variables: TVariables) => TData | undefined,
  pending: () => number,
) {
  const isOnlyPending = () => pending() === 1;
  return {
    onMutate: async (variables: TVariables): Promise<Snapshot> => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      client.setQueryData<TData>(queryKey, (current) => apply(current, variables));
      return { previous };
    },
    onError: (_error: unknown, _variables: TVariables, snapshot: Snapshot | undefined) => {
      if (snapshot && isOnlyPending()) client.setQueryData(queryKey, snapshot.previous);
    },
    onSettled: () => {
      if (isOnlyPending()) void client.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Options shared by the mutations of one query. They run one at a time in a scope named after
 * the query and write their change into its cache (`cacheChange`).
 */
function optimistic<TData, TVariables>(
  client: QueryClient,
  queryKey: readonly ["plans"] | readonly ["shops"] | readonly ["profile"] | readonly ["spuMonths"],
  apply: (current: TData | undefined, variables: TVariables) => TData | undefined,
  pending = () => client.isMutating({ mutationKey: queryKey }),
) {
  return {
    mutationKey: queryKey,
    scope: { id: queryKey[0] },
    ...cacheChange(client, queryKey, apply, pending),
  };
}

const upsert = <T extends { id: string }>(list: T[] | undefined, value: T): T[] =>
  list?.some((item) => item.id === value.id)
    ? list.map((item) => (item.id === value.id ? value : item))
    : [...(list ?? []), value];

/**
 * A change to one plan. `change` gets the plan as it is at that point: in the cache for the
 * optimistic update, and in the repository when saving, so a failed earlier change is never saved
 * along with a later one.
 */
export type PlanChange = {
  planId: string;
  change: (plan: Plan | undefined) => Plan;
  /** A shop saved along with the plan, in the same write: the new shop an order names. */
  shop?: ShopChange;
};

/** A change that replaces the whole plan, for creating or saving a plan as it is. */
export function replacePlan(plan: Plan): PlanChange {
  return { planId: plan.id, change: () => plan };
}

/** The plans in the repository right before and right after a saved plan change. */
export type SavedPlans = { before: Plan[]; after: Plan[] };

type PlanSnapshot = Snapshot & { shops?: Snapshot };

export const savePlanAtom = atomWithMutation<SavedPlans, PlanChange, Error, PlanSnapshot>((get) => {
  const repository = get(repositoryAtom);
  const client = get(queryClientAtom);
  const plans = optimistic(
    client,
    queryKeys.plans,
    (plans: Plan[] | undefined, variables: PlanChange) =>
      upsert(
        plans,
        stamp(variables.change(plans?.find((plan) => plan.id === variables.planId)), variables),
      ),
  );
  const shops = cacheChange(client, queryKeys.shops, changedShops, () => shopsPending(client));
  return {
    mutationFn: async (variables) => {
      const { planId, shop } = variables;
      const others = (await repository.plans.list()).filter((plan) => plan.id !== planId);
      const { before, after } = await repository.plans.update(
        planId,
        (plan) => stamp(variables.change(plan), variables),
        shop && { ...shop, change: (stored) => stamp(shop.change(stored), shop, stored) },
      );
      return { before: before ? upsert(others, before) : others, after: upsert(others, after) };
    },
    ...plans,
    onMutate: async (variables) => ({
      ...(await plans.onMutate(variables)),
      shops: variables.shop && (await shops.onMutate(variables.shop)),
    }),
    onError: (error, variables, snapshot) => {
      plans.onError(error, variables, snapshot);
      if (variables.shop) shops.onError(error, variables.shop, snapshot?.shops);
    },
    onSettled: (_data, _error, variables) => {
      plans.onSettled();
      if (variables.shop) shops.onSettled();
    },
  };
});

export const deletePlanAtom = atomWithMutation<void, string, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  return {
    mutationFn: (id) => repository.plans.delete(id),
    ...optimistic(get(queryClientAtom), queryKeys.plans, (plans: Plan[] | undefined, id: string) =>
      plans?.filter((plan) => plan.id !== id),
    ),
  };
});

/**
 * A change to one shop. Like a plan change, `change` gets the shop as it is in the cache for the
 * optimistic update and in the repository when saving.
 */
export type ShopChange = NonNullable<Parameters<Repository["plans"]["update"]>[2]>;

/** A change that replaces the whole shop, for creating a shop. */
export function replaceShop(shop: Shop): ShopChange {
  return { shopId: shop.id, change: () => shop };
}

/** A change to a shop that has to exist already. */
export function changeShop(shopId: string, change: (shop: Shop) => Shop): ShopChange {
  return {
    shopId,
    change: (shop) => {
      if (!shop) throw new Error(`shop ${shopId} does not exist`);
      return change(shop);
    },
  };
}

const changedShops = (shops: Shop[] | undefined, variables: ShopChange) => {
  const stored = shops?.find((shop) => shop.id === variables.shopId);
  if (variables.onlyIfMissing && stored) return shops;
  return upsert(shops, stamp(variables.change(stored), variables, stored));
};

/** How many pending mutations change the shops: shop changes, and plan changes with a shop. */
const shopsPending = (client: QueryClient) =>
  client.isMutating({
    predicate: (mutation) =>
      mutation.options.mutationKey?.[0] === queryKeys.shops[0] ||
      (mutation.state.variables as Partial<PlanChange> | undefined)?.shop !== undefined,
  });

export const saveShopAtom = atomWithMutation<void, ShopChange, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  const client = get(queryClientAtom);
  return {
    mutationFn: (variables) =>
      repository.shops.update(variables.shopId, (stored) =>
        stamp(variables.change(stored), variables, stored),
      ),
    ...optimistic(client, queryKeys.shops, changedShops, () => shopsPending(client)),
  };
});

/**
 * A change to the profile, applied to the profile as it is like a plan change. A profile that was
 * never saved starts from the default one.
 */
export type ProfileChange = { change: (profile: Profile) => Profile };

export const saveProfileAtom = atomWithMutation<void, ProfileChange, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  return {
    mutationFn: async (variables) => {
      const stored = (await repository.profile.get()) ?? defaultProfile();
      await repository.profile.put(stamp(variables.change(stored), variables));
    },
    ...optimistic(
      get(queryClientAtom),
      queryKeys.profile,
      (current: Profile | undefined, variables: ProfileChange) =>
        stamp(variables.change(current ?? defaultProfile()), variables),
    ),
  };
});

/**
 * A change to the SPU of one account and month. `change` gets the ids that are on as they are at
 * that point, a month not stored yet as it starts (`spuIdsIn`), like a plan change.
 */
export type SpuMonthChange = {
  accountId: string;
  month: string;
  change: (ids: ReadonlySet<string>) => string[];
};

const changedMonth = (months: SpuMonth[], variables: SpuMonthChange): SpuMonth => {
  const { accountId, month, change } = variables;
  return stamp(
    {
      id: spuMonthId(accountId, month),
      accountId,
      month,
      enabledIds: change(spuIdsIn(months, accountId, month)),
      updatedAt: "",
    },
    variables,
  );
};

export const saveSpuMonthAtom = atomWithMutation<void, SpuMonthChange, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  return {
    mutationFn: async (variables) => {
      await repository.spuMonths.put(changedMonth(await repository.spuMonths.list(), variables));
    },
    ...optimistic(
      get(queryClientAtom),
      queryKeys.spuMonths,
      (months: SpuMonth[] | undefined, variables: SpuMonthChange) =>
        upsert(months, changedMonth(months ?? [], variables)),
    ),
  };
});

/** Removes every stored row, then reads everything again so each screen starts over empty. */
export const clearDataAtom = atomWithMutation<void, void>((get) => {
  const repository = get(repositoryAtom);
  const client = get(queryClientAtom);
  return {
    mutationFn: () => repository.clear(),
    onSettled: () => client.resetQueries(),
  };
});

/** Removes one row set aside, or all of them when no key is given. */
export const deleteQuarantinedAtom = atomWithMutation<void, number | undefined>((get) => {
  const repository = get(repositoryAtom);
  const client = get(queryClientAtom);
  return {
    mutationFn: (key) =>
      key === undefined ? repository.quarantine.clear() : repository.quarantine.delete(key),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.quarantine });
      await client.invalidateQueries({ queryKey: queryKeys.storageHealth });
    },
  };
});
