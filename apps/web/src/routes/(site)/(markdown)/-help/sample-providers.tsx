import { QueryClient } from "@tanstack/react-query";
import type { Profile } from "@workspaces/domain";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import { type ReactNode, useState } from "react";
import { queryKeys } from "#/state/queries.ts";
import { repositoryAtom } from "#/state/repository.ts";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import { fixedTodayAtom } from "#/routes/-use-today.ts";
import {
  SAMPLE_EVENTS,
  SAMPLE_PLANS,
  SAMPLE_SHOPS,
  SAMPLE_SPU_MONTHS,
  SAMPLE_TODAY,
} from "./sample-data.ts";

const SAMPLE_PROFILE: Profile = { updatedAt: "2026-10-27T00:00:00.000Z" };

/** The sample's data in a client of its own, read at once: the server renders the figure too. */
function sampleClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });
  client.setQueryData(queryKeys.plans, SAMPLE_PLANS);
  client.setQueryData(queryKeys.shops, SAMPLE_SHOPS);
  client.setQueryData(queryKeys.profile, SAMPLE_PROFILE);
  client.setQueryData(queryKeys.spuMonths, SAMPLE_SPU_MONTHS);
  client.setQueryData(queryKeys.officialEvents, SAMPLE_EVENTS);
  client.setQueryData(queryKeys.syncEnabled, false);
  return client;
}

function HydrateSample({ children }: { children: ReactNode }) {
  const [repository] = useState(() =>
    createMemoryRepository({
      plans: SAMPLE_PLANS,
      shops: SAMPLE_SHOPS,
      profile: SAMPLE_PROFILE,
      spuMonths: SAMPLE_SPU_MONTHS,
    }),
  );
  useHydrateAtoms([
    [repositoryAtom, repository],
    [fixedTodayAtom, SAMPLE_TODAY],
  ] as const);
  return children;
}

/**
 * A store of its own holding the sample plans, so the app's components draw them as they draw the
 * user's: the user's own plans, in the app's store, stay out of the figure and the figure out of them.
 */
export function SampleProviders({ children }: { children: ReactNode }) {
  const [client] = useState(sampleClient);
  return (
    <QueryClientAtomProvider client={client}>
      <HydrateSample>{children}</HydrateSample>
    </QueryClientAtomProvider>
  );
}
