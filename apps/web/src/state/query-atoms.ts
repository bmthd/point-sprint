import type { Plan, Shop, SpuMonth } from "@workspaces/domain";
import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { repositoryAtom } from "./repository.ts";
import {
  defaultProfile,
  plansQueryOptions,
  shopsQueryOptions,
  profileQueryOptions,
  spuMonthsQueryOptions,
  noticeReadsQueryOptions,
  storageHealthQueryOptions,
  quarantineQueryOptions,
} from "./queries.ts";

export const plansQueryAtom = atomWithQuery((get) =>
  plansQueryOptions({ repository: get(repositoryAtom) }),
);
export const shopsQueryAtom = atomWithQuery((get) =>
  shopsQueryOptions({ repository: get(repositoryAtom) }),
);

export const retryPlanPageLoadAtom = atom(null, (get) => {
  const plans = get(plansQueryAtom);
  const shops = get(shopsQueryAtom);
  if (plans.isError) void plans.refetch();
  if (shops.isError) void shops.refetch();
});
export const profileQueryAtom = atomWithQuery((get) =>
  profileQueryOptions({ repository: get(repositoryAtom) }),
);
export const spuMonthsQueryAtom = atomWithQuery((get) =>
  spuMonthsQueryOptions({ repository: get(repositoryAtom) }),
);

/** The notices read on this device or one it syncs with. None until read: unknown on the server. */
export const noticeReadsQueryAtom = atomWithQuery((get) =>
  noticeReadsQueryOptions({ repository: get(repositoryAtom) }),
);

/** Read health again after all stored data is read, since reading can quarantine rows. */
export const storageHealthQueryAtom = atomWithQuery((get) => {
  const repository = get(repositoryAtom);
  const plans = get(plansQueryAtom);
  const shops = get(shopsQueryAtom);
  const profile = get(profileQueryAtom);
  const spuMonths = get(spuMonthsQueryAtom);
  return storageHealthQueryOptions(
    { repository },
    {
      enabled: plans.isSuccess && shops.isSuccess && profile.isSuccess && spuMonths.isSuccess,
      dataUpdatedAt: [
        plans.dataUpdatedAt,
        shops.dataUpdatedAt,
        profile.dataUpdatedAt,
        spuMonths.dataUpdatedAt,
      ],
    },
  );
});

/** The rows set aside because they failed validation, read only while someone looks at them. */
export const quarantineQueryAtom = atomWithQuery((get) =>
  quarantineQueryOptions({ repository: get(repositoryAtom) }),
);

const noPlans: Plan[] = [];
const noShops: Shop[] = [];
const noSpuMonths: SpuMonth[] = [];
const fallbackProfile = defaultProfile();

export const plansAtom = atom((get) => get(plansQueryAtom).data ?? noPlans);
export const shopsAtom = atom((get) => get(shopsQueryAtom).data ?? noShops);
export const profileAtom = atom((get) => get(profileQueryAtom).data ?? fallbackProfile);
export const spuMonthsAtom = atom((get) => get(spuMonthsQueryAtom).data ?? noSpuMonths);
