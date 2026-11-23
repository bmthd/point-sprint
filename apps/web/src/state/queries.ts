import { queryOptions } from "@tanstack/react-query";
import type { Profile } from "@workspaces/domain";
import type { Repository } from "#/storage/repository.ts";
import { appQueryOptions } from "./app-query-options.ts";

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

type RepositoryQueryDeps = { repository: Repository };
type StorageHealthOptions = {
  enabled: boolean;
  dataUpdatedAt: readonly [number, number, number, number];
};

export const plansQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({ queryKey: queryKeys.plans, queryFn: () => repository.plans.list() }),
);

export const shopsQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({ queryKey: queryKeys.shops, queryFn: () => repository.shops.list() }),
);

export const profileQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({
    queryKey: queryKeys.profile,
    queryFn: async () => (await repository.profile.get()) ?? defaultProfile(),
  }),
);

export const spuMonthsQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({ queryKey: queryKeys.spuMonths, queryFn: () => repository.spuMonths.list() }),
);

export const noticeReadsQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({ queryKey: queryKeys.noticeReads, queryFn: () => repository.noticeReads.list() }),
);

export const storageHealthQueryOptions = appQueryOptions(
  ({ repository }: RepositoryQueryDeps, { enabled, dataUpdatedAt }: StorageHealthOptions) =>
    queryOptions({
      queryKey: [...queryKeys.storageHealth, ...dataUpdatedAt],
      enabled,
      queryFn: async () => ({
        quarantined: await repository.quarantined(),
        wasReset: repository.wasReset(),
      }),
    }),
);

export const quarantineQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({ queryKey: queryKeys.quarantine, queryFn: () => repository.quarantine.list() }),
);

export const syncEnabledQueryOptions = appQueryOptions(({ repository }: RepositoryQueryDeps) =>
  queryOptions({
    queryKey: queryKeys.syncEnabled,
    queryFn: async () => (await repository.sync.meta.get()) !== undefined,
  }),
);
