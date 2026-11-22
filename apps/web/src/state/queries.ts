import { queryOptions } from "@tanstack/react-query";
import type { Profile } from "@workspaces/domain";
import type { Repository } from "#/storage/repository.ts";

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

export function syncEnabledQueryOptions(repository: Repository) {
  return queryOptions({
    queryKey: queryKeys.syncEnabled,
    queryFn: async () => (await repository.sync.meta.get()) !== undefined,
  });
}
