import { type Plan, type Profile, type Shop, standardSpu } from "@workspaces/domain";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { repositoryAtom } from "./repository";

export const queryKeys = {
  plans: ["plans"],
  shops: ["shops"],
  profile: ["profile"],
  storageHealth: ["storage-health"],
} as const;

export const defaultProfile = (): Profile => ({
  spuBenefits: structuredClone(standardSpu),
  updatedAt: new Date().toISOString(),
});

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

/**
 * What went wrong while reading the stored data: rows set aside because they failed validation,
 * or a database recreated empty. Rows are set aside as they are read, so this asks again after
 * the plans, shops and profile have been read.
 */
export const storageHealthQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  const plans = get(plansQueryAtom);
  const shops = get(shopsQueryAtom);
  const profile = get(profileQueryAtom);
  return {
    queryKey: [
      ...queryKeys.storageHealth,
      plans.dataUpdatedAt,
      shops.dataUpdatedAt,
      profile.dataUpdatedAt,
    ],
    enabled: plans.isSuccess && shops.isSuccess && profile.isSuccess,
    queryFn: async () => ({
      quarantined: await repository.quarantined(),
      wasReset: repository.wasReset(),
    }),
  };
});

const noPlans: Plan[] = [];
const noShops: Shop[] = [];
const fallbackProfile = defaultProfile();

export const plansAtom = atom((get) => get(plansQueryAtom).data ?? noPlans);
export const shopsAtom = atom((get) => get(shopsQueryAtom).data ?? noShops);
export const profileAtom = atom((get) => get(profileQueryAtom).data ?? fallbackProfile);
