import { queryOptions } from "@tanstack/react-query";
import type { OfficialEvent } from "@workspaces/domain";
import { appQueryOptions } from "#/state/app-query-options.ts";
import { queryKeys } from "#/state/queries.ts";

// The master changes a few times a day at most.
export const officialEventsQueryOptions = appQueryOptions(
  ({ load }: { load: () => Promise<OfficialEvent[]> }) =>
    queryOptions({ queryKey: queryKeys.officialEvents, queryFn: load, staleTime: 10 * 60_000 }),
);
