import type { Plan, Profile, Shop } from "@workspaces/domain";
import type { QueryClient } from "@tanstack/query-core";
import { atomWithMutation, queryClientAtom } from "jotai-tanstack-query";
import { defaultProfile, queryKeys } from "./queries";
import { repositoryAtom } from "./repository";

const timestamps = new WeakMap<object, string>();

/** One timestamp per mutation call, so the cache and the repository get the same `updatedAt`. */
const stamp = <T extends { updatedAt: string }>(value: T, variables: object): T => {
  const updatedAt = timestamps.get(variables) ?? new Date().toISOString();
  timestamps.set(variables, updatedAt);
  return { ...value, updatedAt };
};

type Snapshot = { previous: unknown };

/**
 * Options shared by the mutations of one query. They run one at a time in a scope named after
 * the query and write their change into the cache before the repository is asked.
 *
 * - On failure the previous value comes back only when no other mutation of the query is
 *   pending; the snapshot would otherwise erase that mutation's change.
 * - The query is fetched again once the last pending mutation settles, which also clears a failed
 *   change that could not be rolled back.
 */
function optimistic<TData, TVariables>(
  client: QueryClient,
  queryKey: readonly ["plans"] | readonly ["shops"] | readonly ["profile"],
  apply: (current: TData | undefined, variables: TVariables) => TData | undefined,
) {
  const isOnlyPending = () => client.isMutating({ mutationKey: queryKey }) === 1;
  return {
    mutationKey: queryKey,
    scope: { id: queryKey[0] },
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

const upsert = <T extends { id: string }>(list: T[] | undefined, value: T): T[] =>
  list?.some((item) => item.id === value.id)
    ? list.map((item) => (item.id === value.id ? value : item))
    : [...(list ?? []), value];

/**
 * A change to one plan. `change` gets the plan as it is at that point: in the cache for the
 * optimistic update, and in the repository when saving, so a failed earlier change is never saved
 * along with a later one.
 */
export type PlanChange = { planId: string; change: (plan: Plan | undefined) => Plan };

/** A change that replaces the whole plan, for creating or saving a plan as it is. */
export const replacePlan = (plan: Plan): PlanChange => ({ planId: plan.id, change: () => plan });

export const savePlanAtom = atomWithMutation<void, PlanChange, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  return {
    mutationFn: async (variables) => {
      const stored = await repository.plans.get(variables.planId);
      await repository.plans.put(stamp(variables.change(stored), variables));
    },
    ...optimistic(
      get(queryClientAtom),
      queryKeys.plans,
      (plans: Plan[] | undefined, variables: PlanChange) =>
        upsert(
          plans,
          stamp(variables.change(plans?.find((plan) => plan.id === variables.planId)), variables),
        ),
    ),
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
export type ShopChange = { shopId: string; change: (shop: Shop | undefined) => Shop };

/** A change that replaces the whole shop, for creating a shop. */
export const replaceShop = (shop: Shop): ShopChange => ({ shopId: shop.id, change: () => shop });

/** A change to a shop that has to exist already. */
export const changeShop = (shopId: string, change: (shop: Shop) => Shop): ShopChange => ({
  shopId,
  change: (shop) => {
    if (!shop) throw new Error(`shop ${shopId} does not exist`);
    return change(shop);
  },
});

export const saveShopAtom = atomWithMutation<void, ShopChange, Error, Snapshot>((get) => {
  const repository = get(repositoryAtom);
  return {
    mutationFn: async (variables) => {
      const stored = (await repository.shops.list()).find((shop) => shop.id === variables.shopId);
      await repository.shops.put(stamp(variables.change(stored), variables));
    },
    ...optimistic(
      get(queryClientAtom),
      queryKeys.shops,
      (shops: Shop[] | undefined, variables: ShopChange) =>
        upsert(
          shops,
          stamp(variables.change(shops?.find((shop) => shop.id === variables.shopId)), variables),
        ),
    ),
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
