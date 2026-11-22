import { queryOptions } from "@tanstack/react-query";
import type { OfficialEvent } from "@workspaces/domain";
import { queryKeys } from "#/state/queries.ts";

export function officialEventsQueryOptions(load: () => Promise<OfficialEvent[]>) {
  // The master changes a few times a day at most.
  return queryOptions({
    queryKey: queryKeys.officialEvents,
    queryFn: load,
    staleTime: 10 * 60_000,
  });
}
