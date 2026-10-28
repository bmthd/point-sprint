import type { Plan, Profile, Shop, SpuMonth } from "@workspaces/domain";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { repositoryAtom } from "./repository";

export const queryKeys = {
  syncEnabled: ["sync-enabled"],
  officialEvents: ["official-events"],
  plans: ["plans"],
  shops: ["shops"],
  profile: ["profile"],
  spuMonths: ["spuMonths"],
  storageHealth: ["storage-health"],
  quarantine: ["quarantine"],
} as const;

export function defaultProfile(): Profile {
  return { updatedAt: new Date().toISOString() };
}

export const plansQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return { queryKey: queryKeys.plans, queryFn: () => repository.plans.list() };
});

export const shopsQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return { queryKey: queryKeys.shops, queryFn: () => repository.shops.list() };
});

export const profileQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return {
    queryKey: queryKeys.profile,
    queryFn: async () => (await repository.profile.get()) ?? defaultProfile(),
  };
});

export const spuMonthsQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return { queryKey: queryKeys.spuMonths, queryFn: () => repository.spuMonths.list() };
});

/**
 * What went wrong while reading the stored data: rows set aside because they failed validation,
 * or a database recreated empty. Rows are set aside as they are read, so this asks again after
 * the plans, shops, profile and SPU months have been read.
 */
export const storageHealthQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  const plans = get(plansQueryAtom);
  const shops = get(shopsQueryAtom);
  const profile = get(profileQueryAtom);
  const spuMonths = get(spuMonthsQueryAtom);
  return {
    queryKey: [
      ...queryKeys.storageHealth,
      plans.dataUpdatedAt,
      shops.dataUpdatedAt,
      profile.dataUpdatedAt,
      spuMonths.dataUpdatedAt,
    ],
    enabled: plans.isSuccess && shops.isSuccess && profile.isSuccess && spuMonths.isSuccess,
    queryFn: async () => ({
      quarantined: await repository.quarantined(),
      wasReset: repository.wasReset(),
    }),
  };
});

/** The rows set aside because they failed validation, read only while someone looks at them. */
export const quarantineQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  return { queryKey: queryKeys.quarantine, queryFn: () => repository.quarantine.list() };
});

const noPlans: Plan[] = [];
const noShops: Shop[] = [];
const noSpuMonths: SpuMonth[] = [];
const fallbackProfile = defaultProfile();

export const plansAtom = atom((get) => get(plansQueryAtom).data ?? noPlans);
export const shopsAtom = atom((get) => get(shopsQueryAtom).data ?? noShops);
export const profileAtom = atom((get) => get(profileQueryAtom).data ?? fallbackProfile);
export const spuMonthsAtom = atom((get) => get(spuMonthsQueryAtom).data ?? noSpuMonths);
