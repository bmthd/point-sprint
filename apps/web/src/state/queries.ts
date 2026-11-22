import type { Plan, Profile, Shop, SpuMonth } from "@workspaces/domain";
import { queryOptions } from "@tanstack/react-query";
import type { Repository } from "#/storage/repository.ts";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { repositoryAtom } from "./repository.ts";

export const queryKeys = {
  syncEnabled: ["sync-enabled"],
  officialEvents: ["official-events"],
  plans: ["plans"],
  shops: ["shops"],
  profile: ["profile"],
  spuMonths: ["spuMonths"],
  noticeReads: ["noticeReads"],
  storageHealth: ["storage-health"],
  quarantine: ["quarantine"],
} as const;

export function defaultProfile(): Profile {
  return { updatedAt: new Date().toISOString() };
}

export function plansQueryOptions(repository: Repository) {
  return queryOptions({ queryKey: queryKeys.plans, queryFn: () => repository.plans.list() });
}

export function shopsQueryOptions(repository: Repository) {
  return queryOptions({ queryKey: queryKeys.shops, queryFn: () => repository.shops.list() });
}

export function profileQueryOptions(repository: Repository) {
  return queryOptions({
    queryKey: queryKeys.profile,
    queryFn: async () => (await repository.profile.get()) ?? defaultProfile(),
  });
}

export function spuMonthsQueryOptions(repository: Repository) {
  return queryOptions({
    queryKey: queryKeys.spuMonths,
    queryFn: () => repository.spuMonths.list(),
  });
}

export function noticeReadsQueryOptions(repository: Repository) {
  return queryOptions({
    queryKey: queryKeys.noticeReads,
    queryFn: () => repository.noticeReads.list(),
  });
}

export function storageHealthQueryOptions(
  repository: Repository,
  {
    enabled,
    dataUpdatedAt,
  }: { enabled: boolean; dataUpdatedAt: readonly [number, number, number, number] },
) {
  return queryOptions({
    queryKey: [...queryKeys.storageHealth, ...dataUpdatedAt],
    enabled,
    queryFn: async () => ({
      quarantined: await repository.quarantined(),
      wasReset: repository.wasReset(),
    }),
  });
}

export function quarantineQueryOptions(repository: Repository) {
  return queryOptions({
    queryKey: queryKeys.quarantine,
    queryFn: () => repository.quarantine.list(),
  });
}

export const plansQueryAtom = atomWithQuery((get) => plansQueryOptions(get(repositoryAtom)));
export const shopsQueryAtom = atomWithQuery((get) => shopsQueryOptions(get(repositoryAtom)));
export const profileQueryAtom = atomWithQuery((get) => profileQueryOptions(get(repositoryAtom)));
export const spuMonthsQueryAtom = atomWithQuery((get) =>
  spuMonthsQueryOptions(get(repositoryAtom)),
);

/** The notices read on this device or one it syncs with. None until read: unknown on the server. */
export const noticeReadsQueryAtom = atomWithQuery((get) =>
  noticeReadsQueryOptions(get(repositoryAtom)),
);

/** Read health again after all stored data is read, since reading can quarantine rows. */
export const storageHealthQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  const plans = get(plansQueryAtom);
  const shops = get(shopsQueryAtom);
  const profile = get(profileQueryAtom);
  const spuMonths = get(spuMonthsQueryAtom);
  return storageHealthQueryOptions(repository, {
    enabled: plans.isSuccess && shops.isSuccess && profile.isSuccess && spuMonths.isSuccess,
    dataUpdatedAt: [
      plans.dataUpdatedAt,
      shops.dataUpdatedAt,
      profile.dataUpdatedAt,
      spuMonths.dataUpdatedAt,
    ],
  });
});

/** The rows set aside because they failed validation, read only while someone looks at them. */
export const quarantineQueryAtom = atomWithQuery((get) =>
  quarantineQueryOptions(get(repositoryAtom)),
);

const noPlans: Plan[] = [];
const noShops: Shop[] = [];
const noSpuMonths: SpuMonth[] = [];
const fallbackProfile = defaultProfile();

export const plansAtom = atom((get) => get(plansQueryAtom).data ?? noPlans);
export const shopsAtom = atom((get) => get(shopsQueryAtom).data ?? noShops);
export const profileAtom = atom((get) => get(profileQueryAtom).data ?? fallbackProfile);
export const spuMonthsAtom = atom((get) => get(spuMonthsQueryAtom).data ?? noSpuMonths);
