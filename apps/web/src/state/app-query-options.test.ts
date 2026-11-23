import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { Plan } from "@workspaces/domain";
import { expect, expectTypeOf, test } from "vitest";
import { appQueryOptions } from "./app-query-options.ts";
import { queryKeys } from "./queries.ts";

test("preserves generic select inference and the fetched data type of the cache", async () => {
  const selectedPlans = appQueryOptions(
    <TData = Plan[]>(
      { load }: { load: () => Promise<Plan[]> },
      options: { select?: (plans: Plan[]) => TData },
    ) => ({ queryKey: queryKeys.plans, queryFn: load, select: options.select }),
  );
  const deps = { load: async (): Promise<Plan[]> => [] };
  const selected = selectedPlans(deps, { select: (plans) => plans.length });
  const unselected = selectedPlans(deps, {});
  const client = new QueryClient();
  try {
    const result = await client.query(selected);
    expect(result).toBe(0);
    expectTypeOf(result).toEqualTypeOf<number>();
    expect(client.getQueryData(selected.queryKey)).toEqual([]);
    const observer = new QueryObserver(client, selected);
    expect(observer.getCurrentResult().data).toBe(0);
    expectTypeOf(observer.getCurrentResult().data).toEqualTypeOf<number | undefined>();
    expectTypeOf(client.getQueryData(selected.queryKey)).toEqualTypeOf<Plan[] | undefined>();
    const unselectedObserver = new QueryObserver(client, unselected);
    expectTypeOf(unselectedObserver.getCurrentResult().data).toEqualTypeOf<Plan[] | undefined>();
    unselectedObserver.destroy();
    observer.destroy();
  } finally {
    client.clear();
  }
});

test("plain options retain queryKey literals and fetched cache data types", async () => {
  const plans = appQueryOptions(({ load }: { load: () => Promise<Plan[]> }) => ({
    queryKey: queryKeys.plans,
    queryFn: load,
  }));
  const options = plans({ load: async () => [] });
  const client = new QueryClient();
  try {
    expect(await client.query(options)).toEqual([]);
    expectTypeOf(options.queryKey[0]).toEqualTypeOf<"plans">();
    expectTypeOf(client.getQueryData(options.queryKey)).toEqualTypeOf<Plan[] | undefined>();
  } finally {
    client.clear();
  }
});
