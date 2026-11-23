import { QueryClient } from "@tanstack/react-query";
import type { OfficialEvent, Plan } from "@workspaces/domain";
import { createStore } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { expect, expectTypeOf, test } from "vitest";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import { officialEventsQueryAtom, officialEventsSourceAtom } from "#/routes/-official-events.ts";
import {
  plansQueryOptions,
  syncEnabledQueryOptions,
  shopsQueryOptions,
  profileQueryOptions,
  spuMonthsQueryOptions,
  noticeReadsQueryOptions,
  quarantineQueryOptions,
  storageHealthQueryOptions,
} from "./queries.ts";
import type { Repository } from "#/storage/repository.ts";
import { plansQueryAtom } from "./query-atoms.ts";
import { repositoryAtom } from "./repository.ts";
import { officialEventsQueryOptions } from "#/routes/-official-events-query.ts";

test("reads repository data without subscribing and shares it with the query atom", async () => {
  const repository = createMemoryRepository();
  const client = new QueryClient();
  try {
    const options = plansQueryOptions({ repository });
    expect(await client.query(options)).toEqual([]);
    expectTypeOf(client.getQueryData(options.queryKey)).toEqualTypeOf<Plan[] | undefined>();
    const store = createStore();
    store.set(queryClientAtom, client);
    store.set(repositoryAtom, repository);
    expect(store.get(plansQueryAtom).data).toEqual([]);
    expect(await client.query(shopsQueryOptions({ repository }))).toEqual([]);
    expect(await client.query(spuMonthsQueryOptions({ repository }))).toEqual([]);
    expect(await client.query(noticeReadsQueryOptions({ repository }))).toEqual([]);
    expect(await client.query(quarantineQueryOptions({ repository }))).toEqual([]);
    expect(await client.query(syncEnabledQueryOptions({ repository }))).toBe(false);
    const profile = { updatedAt: "2026-11-22T00:00:00.000Z" };
    await repository.profile.put(profile);
    expect(await client.query(profileQueryOptions({ repository }))).toEqual(profile);
  } finally {
    client.clear();
  }
});

test("uses a default profile only when this repository has none", async () => {
  const client = new QueryClient();
  try {
    expect(
      await client.query(profileQueryOptions({ repository: createMemoryRepository() })),
    ).toEqual({
      updatedAt: expect.any(String),
    });
  } finally {
    client.clear();
  }
});

test("keeps official event source injection per store and imperative cache reuse", async () => {
  const client = new QueryClient();
  const events = [
    {
      id: "test",
      name: "test",
      period: { start: "2026-11-01", end: "2026-11-30" },
      url: "https://example.com",
      benefits: [],
    },
  ];
  const load = async () => events;
  try {
    const options = officialEventsQueryOptions({ load });
    expect(await client.query(options)).toEqual(events);
    const store = createStore();
    store.set(queryClientAtom, client);
    store.set(officialEventsSourceAtom, {
      load: async () => {
        throw new Error("fresh cache should be reused");
      },
    });
    expect(store.get(officialEventsQueryAtom).data).toEqual(events);
    expect(options.staleTime).toBe(10 * 60_000);
  } finally {
    client.clear();
  }
});

test("storage health keeps readiness and read timestamps in its options", async () => {
  const repository = createMemoryRepository();
  const before = storageHealthQueryOptions(
    { repository },
    {
      enabled: false,
      dataUpdatedAt: [0, 0, 0, 0],
    },
  );
  const after = storageHealthQueryOptions(
    { repository },
    {
      enabled: true,
      dataUpdatedAt: [1, 2, 3, 4],
    },
  );
  expect(before.enabled).toBe(false);
  expect(after.enabled).toBe(true);
  expect(before.queryKey).not.toEqual(after.queryKey);
  const client = new QueryClient();
  try {
    expect(await client.query(after)).toEqual({ quarantined: 0, wasReset: false });
  } finally {
    client.clear();
  }
});

test("query factories accept named dependencies without an empty options argument", () => {
  expectTypeOf(plansQueryOptions).parameters.toEqualTypeOf<[{ repository: Repository }]>();
  expectTypeOf(officialEventsQueryOptions).parameters.toEqualTypeOf<
    [{ load: () => Promise<OfficialEvent[]> }]
  >();
  expectTypeOf(storageHealthQueryOptions).parameters.toEqualTypeOf<
    [
      { repository: Repository },
      { enabled: boolean; dataUpdatedAt: readonly [number, number, number, number] },
    ]
  >();
});
