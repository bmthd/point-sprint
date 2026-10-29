import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { type OfficialEvent, type Plan, type Shop, defaultAccount } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { page, userEvent } from "vitest/browser";
import { expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { repositoryAtom } from "../../../state/repository";
import { createMemoryRepository } from "../../../storage/memory-repository";
import type { Repository } from "../../../storage/repository";
import type { Article } from "../../../guides/article";
import { guideCards } from "../../../guides/guide-cards";
import { TestColorMode } from "../../../test-color-mode";
import { expectTexts } from "../../../test-texts";
import { officialEventsSourceAtom } from "../../-official-events";
import { useToday } from "../../-use-today";
import { TopPage } from "./top-page";

// 2026-10-05 12:00 in Japan: the October marathon (10/4〜10/9) is running.
const now = () => new Date("2026-10-05T03:00:00Z");

const SHOP = "a0000000-0000-4000-8000-000000000001";
const shop: Shop = {
  id: SHOP,
  channel: "rakuten-ichiba",
  name: "ショップ",
  tags: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
};

const plan = (id: string, name: string, updatedAt: string, orderCount: number): Plan => ({
  id,
  name,
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: Array.from({ length: orderCount }, (_, index) => ({
    id: `0${index}000000-0000-4000-8000-000000000000`,
    shopId: SHOP,
    date: "2026-10-05",
    lineItems: [
      {
        id: `0${index}000000-0000-4000-8000-000000000001`,
        name: "item",
        unitPrice: 10000,
        quantity: 1,
        taxRate: 0,
        discount: 0,
        shopPointRate: 2,
      },
    ],
    onHold: false,
    tags: [],
  })),
  updatedAt,
});

const PLAN_A = "f0000000-0000-4000-8000-00000000000a";
const PLAN_B = "f0000000-0000-4000-8000-00000000000b";

const marathon = (input: {
  id: string;
  name: string;
  start: string;
  end: string;
  cap?: number;
}): OfficialEvent => ({
  id: input.id,
  name: input.name,
  period: { start: input.start, end: input.end },
  url: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
  benefits: [
    {
      id: crypto.randomUUID(),
      kind: "shop-around",
      category: "campaign",
      label: "ショップ買いまわり",
      enabled: true,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: input.id,
      conditions: { dateRule: { type: "range", start: input.start, end: input.end } },
      params: {
        tiers: Array.from({ length: 9 }, (_, index) => ({ minShops: index + 2, rate: index + 1 })),
        ...(input.cap === undefined ? {} : { cap: input.cap }),
        roundingUnit: "item",
      },
    },
  ],
});

/** What the Worker serves on the test's day: one round ended, one running and one to come. */
const servedEvents = [
  marathon({
    id: "marathon-2026-09-19",
    name: "お買い物マラソン",
    start: "2026-09-19",
    end: "2026-09-24",
    cap: 7000,
  }),
  marathon({
    id: "marathon-2026-10",
    name: "お買い物マラソン&ジャンル祭",
    start: "2026-10-04",
    end: "2026-10-09",
    cap: 7000,
  }),
  marathon({
    id: "marathon-2026-10-14",
    name: "お買い物マラソン第二弾",
    start: "2026-10-14",
    end: "2026-10-17",
  }),
];

type EventSource = { load: () => Promise<OfficialEvent[]> };

/** The same providers as `AppProviders`, with a repository and events the test holds on to. */
function TestProviders({
  repository,
  events,
  client,
  children,
}: {
  repository: Repository;
  events: EventSource;
  client: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientAtomProvider client={client}>
      <Hydrate repository={repository} events={events}>
        {children}
      </Hydrate>
    </QueryClientAtomProvider>
  );
}

function Hydrate({
  repository,
  events,
  children,
}: {
  repository: Repository;
  events: EventSource;
  children: ReactNode;
}) {
  useHydrateAtoms([
    [repositoryAtom, repository],
    [officialEventsSourceAtom, events],
  ]);
  return children;
}

const article = (index: number): Article => ({
  slug: `guide-${index}`,
  title: `ガイド${index}`,
  description: `ガイド${index}の説明`,
  published: `2026-10-0${index}`,
  body: "",
});

/** Newest first, as the loader reads them, then cut down to the cards. */
const articles = guideCards([5, 4, 3, 2, 1].map(article));

const planRows = () =>
  page.getByRole("region", { name: "自分のプラン", exact: true }).getByRole("listitem");

/**
 * The screen runs in a router with a memory history, so links and `navigate` are the real ones
 * and the test reads where they ended up.
 */
async function renderTopPage(
  repository: Repository,
  options: { events?: EventSource; client?: QueryClient } = {},
) {
  await cleanup();
  // Not retried, so a failing load shows at once.
  const client =
    options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <TopPage now={now} articles={articles} />,
  });
  const planRoute = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <p>プラン画面</p>,
  });
  const profileRoute = createRoute({
    getParentRoute: () => root,
    path: "/settings",
    component: () => <p>プロフィール画面</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, planRoute, profileRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <TestColorMode value="light" />
      <TestProviders
        repository={repository}
        events={options.events ?? { load: async () => servedEvents }}
        client={client}
      >
        <RouterProvider router={router} />
      </TestProviders>
    </UIProvider>,
  );
  return { screen, router };
}

test("creates a plan from an official event and navigates to it", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderTopPage(repository);

  const current = screen.getByRole("listitem").filter({ hasText: "お買い物マラソン&ジャンル祭" });
  const next = screen.getByRole("listitem").filter({ hasText: "お買い物マラソン第二弾" });
  await expect.element(current.getByText("開催中")).toBeVisible();
  await expect
    .element(current.getByText("・買いまわり最大 +9倍・上限 7,000P", { exact: false }))
    .toBeVisible();
  await expect.element(next.getByText("開催予定")).toBeVisible();
  await current.getByRole("button", { name: "このイベントでプランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created, ...rest] = await repository.plans.list();
  expect(rest).toEqual([]);
  expect(created?.name).toBe("10月 お買い物マラソン&ジャンル祭");
  expect(created?.officialEventId).toBe("marathon-2026-10");
  expect(created?.period).toEqual({ start: "2026-10-04", end: "2026-10-09" });
  expect(router.state.location.search).toEqual({ id: created?.id });
});

test("lists only the events that have not ended, and a round whose cap is not out yet", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());

  const next = screen.getByRole("listitem").filter({ hasText: "お買い物マラソン第二弾" });
  await expect.element(next.getByText("・上限は未発表", { exact: false })).toBeVisible();
  await expect.element(screen.getByRole("tabpanel").getByRole("listitem")).toHaveLength(2);
});

test("links each event's name to Rakuten's page in a new tab", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());
  const link = screen.getByRole("link", { name: "お買い物マラソン第二弾" });
  await expect
    .element(link)
    .toHaveAttribute("href", "https://event.rakuten.co.jp/campaign/point-up/marathon/");
  await expect.element(link).toHaveAttribute("target", "_blank");
});

test("sums up an event whose rate the total sets by its highest rate and its cap", async () => {
  const brandDay: OfficialEvent = {
    id: "brand-day-2026-10-20",
    name: "楽天ブランドデー",
    period: { start: "2026-10-20", end: "2026-10-21" },
    benefits: [
      {
        id: crypto.randomUUID(),
        kind: "spend-tiers",
        category: "campaign",
        label: "ブランドデー",
        enabled: true,
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "brand-day-2026-10-20",
        conditions: {
          dateRule: { type: "range", start: "2026-10-20", end: "2026-10-21" },
          orderTags: ["brand-day"],
        },
        params: {
          tiers: [
            { minAmount: 0, rate: 2 },
            { minAmount: 30000, rate: 4 },
          ],
          cap: 4000,
          roundingUnit: "item",
        },
      },
    ],
  };
  const { screen } = await renderTopPage(createMemoryRepository(), {
    events: { load: async () => [brandDay] },
  });

  const card = screen.getByRole("listitem").filter({ hasText: "楽天ブランドデー" });
  await expect
    .element(card.getByText("・合計額で最大 +4倍・上限 4,000P", { exact: false }))
    .toBeVisible();
});

test("says when the events cannot be read, and reads them again", async () => {
  let fail = true;
  const events = {
    load: async () => {
      if (fail) throw new Error("offline");
      return servedEvents;
    },
  };
  const { screen } = await renderTopPage(createMemoryRepository(), { events });

  await expect
    .element(screen.getByRole("tabpanel").getByText("イベントを読み込めませんでした"))
    .toBeVisible();
  fail = false;
  await screen.getByRole("button", { name: "再試行" }).click();
  await expect.element(screen.getByText("お買い物マラソン&ジャンル祭")).toBeVisible();
});

test("shows the latest ended event when none is ahead, and plans with its terms", async () => {
  const repository = createMemoryRepository();
  const earlier = marathon({
    id: "marathon-2026-09-04",
    name: "お買い物マラソン第一弾",
    start: "2026-09-04",
    end: "2026-09-09",
    cap: 7000,
  });
  const { screen, router } = await renderTopPage(repository, {
    events: { load: async () => [...servedEvents.slice(0, 1), earlier] },
  });

  await expect.element(screen.getByRole("heading", { name: "前回のイベント" })).toBeVisible();
  await expect.element(screen.getByText("次回の日程は未発表です")).toBeVisible();
  await expect.element(screen.getByRole("tab").first()).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "この条件で計算してみる" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.officialEventId).toBe("marathon-2026-09-19");
});

test("lists the other ended events in the drawer behind the latest one", async () => {
  const earlier = marathon({
    id: "marathon-2026-09-04",
    name: "お買い物マラソン第一弾",
    start: "2026-09-04",
    end: "2026-09-09",
    cap: 7000,
  });
  const { screen } = await renderTopPage(createMemoryRepository(), {
    events: { load: async () => [...servedEvents.slice(0, 1), earlier] },
  });

  await screen.getByRole("button", { name: "そのほかの終了したイベント（1 件）" }).click();
  await expect.element(screen.getByText("お買い物マラソン第一弾")).toBeVisible();
});

test("does not offer the other ended events when there is only one", async () => {
  const { screen } = await renderTopPage(createMemoryRepository(), {
    events: { load: async () => servedEvents.slice(0, 1) },
  });

  await expect.element(screen.getByRole("heading", { name: "前回のイベント" })).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "そのほかの終了したイベント" }))
    .not.toBeInTheDocument();
});

test("creates a plan from an event that ended, the latest first", async () => {
  const repository = createMemoryRepository();
  const earlier = marathon({
    id: "marathon-2026-09-04",
    name: "お買い物マラソン第一弾",
    start: "2026-09-04",
    end: "2026-09-09",
    cap: 7000,
  });
  const { screen, router } = await renderTopPage(repository, {
    events: { load: async () => [earlier, ...servedEvents] },
  });

  await screen.getByRole("tab", { name: "終了" }).click();
  const cards = screen.getByRole("tabpanel").getByRole("listitem");
  await expect.element(cards).toHaveLength(2);
  await expect
    .element(cards.first().getByRole("link", { name: "お買い物マラソン", exact: true }))
    .toBeVisible();
  await expect.element(cards.first().getByText("終了", { exact: true })).toBeVisible();
  await cards.first().getByRole("button", { name: "このイベントでプランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.name).toBe("9月 お買い物マラソン");
  expect(created?.officialEventId).toBe("marathon-2026-09-19");
  expect(created?.period).toEqual({ start: "2026-09-19", end: "2026-09-24" });
});

test("keeps the events that ended over 30 days ago behind 「もっと見る」", async () => {
  const repository = createMemoryRepository();
  const old = marathon({
    id: "marathon-2026-08-24",
    name: "お買い物マラソン8月",
    start: "2026-08-24",
    end: "2026-08-29",
    cap: 7000,
  });
  const { screen, router } = await renderTopPage(repository, {
    events: { load: async () => [old, ...servedEvents] },
  });

  await screen.getByRole("tab", { name: "終了" }).click();
  await expect.element(screen.getByRole("tabpanel").getByRole("listitem")).toHaveLength(1);
  await screen.getByRole("button", { name: "もっと見る" }).click();
  const drawer = screen.getByRole("dialog", { name: "それより前のイベント" });
  await expect.element(drawer.getByRole("heading", { name: "2026年8月" })).toBeVisible();
  await drawer.getByRole("button", { name: "プランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.officialEventId).toBe("marathon-2026-08-24");
  expect(created?.period).toEqual({ start: "2026-08-24", end: "2026-08-29" });
});

test("creates a plan without an event", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderTopPage(repository);

  await screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.name).toBe("10月の買い物");
  expect(created?.officialEventId).toBeUndefined();
  expect(created?.period).toEqual({ start: "2026-10-05", end: "2026-10-05" });
  expect(router.state.location.search).toEqual({ id: created?.id });
});

test("asks before creating a plan whose name is taken, and can open the existing one", async () => {
  const repository = createMemoryRepository({
    plans: [plan(PLAN_A, "10月の買い物", "2026-10-01T00:00:00.000Z", 0)],
  });
  const { screen, router } = await renderTopPage(repository);
  await expect.element(screen.getByRole("link", { name: /10月の買い物/ })).toBeVisible();

  await screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }).click();
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByText("「10月の買い物」はすでにあります。")).toBeVisible();
  expect(await repository.plans.list()).toHaveLength(1);

  await dialog.getByRole("button", { name: "既存のプランを開く" }).click();
  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  expect(router.state.location.search).toEqual({ id: PLAN_A });
  expect(await repository.plans.list()).toHaveLength(1);
});

test("creates a second plan with a taken name when asked to", async () => {
  const repository = createMemoryRepository({
    plans: [plan(PLAN_A, "10月の買い物", "2026-10-01T00:00:00.000Z", 0)],
  });
  const { screen, router } = await renderTopPage(repository);
  await expect.element(screen.getByRole("link", { name: /10月の買い物/ })).toBeVisible();

  await screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }).click();
  await screen.getByRole("dialog").getByRole("button", { name: "新しく作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const plans = await repository.plans.list();
  expect(plans.map((created) => created.name)).toEqual(["10月の買い物", "10月の買い物"]);
  expect(router.state.location.search).not.toEqual({ id: PLAN_A });
});

test("lists plans with their totals", async () => {
  const repository = createMemoryRepository({
    shops: [shop],
    plans: [
      plan(PLAN_A, "10月の普段の買い物", "2026-10-01T00:00:00.000Z", 1),
      plan(PLAN_B, "10月 お買い物マラソン", "2026-10-05T00:00:00.000Z", 2),
    ],
  });
  const { screen, router } = await renderTopPage(repository);

  await expect.element(screen.getByRole("link", { name: /10月 お買い物マラソン/ })).toBeVisible();
  // Most recently updated first. The shops load after the plans, so wait for the totals. Each
  // order earns the shop's +1倍 and 通常ポイント, 100P each.
  await expectTexts(planRows(), [
    "10月 お買い物マラソン10/1〜10/31・1店舗・2件400P",
    "10月の普段の買い物10/1〜10/31・1店舗・1件200P",
  ]);

  await screen.getByRole("link", { name: /10月の普段の買い物/ }).click();
  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  expect(router.state.location.search).toEqual({ id: PLAN_A });
});

test("deletes a plan after confirmation", async () => {
  const repository = createMemoryRepository({
    shops: [shop],
    plans: [plan(PLAN_A, "消すプラン", "2026-10-01T00:00:00.000Z", 1)],
  });
  const { screen } = await renderTopPage(repository);

  await screen.getByRole("button", { name: "消すプランを削除" }).click();
  await screen.getByRole("button", { name: "キャンセル" }).click();
  expect(await repository.plans.list()).toHaveLength(1);
  await expect.element(screen.getByRole("link", { name: /消すプラン/ })).toBeVisible();

  await screen.getByRole("button", { name: "消すプランを削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();

  await expect.element(screen.getByRole("link", { name: /消すプラン/ })).not.toBeInTheDocument();
  await expect.poll(async () => repository.plans.list()).toEqual([]);
  // The section goes with its last plan.
  await expect.element(page.getByRole("region", { name: "自分のプラン" })).not.toBeInTheDocument();
});

test("hides its plans section until there is a plan", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());
  await expect
    .element(screen.getByRole("heading", { name: "イベント", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("region", { name: "自分のプラン" })).not.toBeInTheDocument();
});

test("lists the four newest guides", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());
  const links = screen.getByRole("region", { name: "買い物ガイド" }).getByRole("link");
  await expect.element(links.nth(3)).toBeVisible();
  expect(links.elements().map((link) => link.textContent)).toEqual([
    "ガイド5",
    "ガイド4",
    "ガイド3",
    "ガイド2",
    "すべての記事",
  ]);
  await expect.element(links.first()).toHaveAttribute("href", "/guides/guide-5");
  await expect.element(links.last()).toHaveAttribute("href", "/guides");
});

test("links to the steps for a first visit", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());
  await expect
    .element(screen.getByRole("link", { name: "はじめての方へ" }))
    .toHaveAttribute("href", "#how-to");
  await expect.element(screen.getByRole("heading", { name: "使い方" })).toBeVisible();
});

test("shows an error and stays put when the plan cannot be saved", async () => {
  const repository = createMemoryRepository();
  repository.plans.update = () => Promise.reject(new Error("quota"));
  const { screen, router } = await renderTopPage(repository);

  await screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }).click();

  await expect
    .element(screen.getByText("プランを作れませんでした。もう一度お試しください。"))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/");
  await expect
    .element(screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }))
    .toBeEnabled();
});

test("deletes a plan with the keyboard only", async () => {
  const repository = createMemoryRepository({
    shops: [shop],
    plans: [plan(PLAN_A, "消すプラン", "2026-10-01T00:00:00.000Z", 1)],
  });
  const { screen } = await renderTopPage(repository);
  const trash = screen.getByRole("button", { name: "消すプランを削除" });
  await expect.element(trash).toBeVisible();

  (trash.element() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByRole("dialog")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(await repository.plans.list()).toHaveLength(1);

  (trash.element() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByRole("dialog")).toBeVisible();
  (screen.getByRole("button", { name: "削除する" }).element() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");

  await expect.poll(async () => repository.plans.list()).toEqual([]);
  // The plans section is gone with its last plan, so focus goes to the events.
  await expect.element(page.getByRole("heading", { name: "イベント", exact: true })).toHaveFocus();
});

test("today moves on at midnight in Japan", async () => {
  await cleanup();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  try {
    // 23:59 on 10/5 in Japan.
    vi.setSystemTime(new Date("2026-10-05T14:59:00Z"));
    function Today() {
      return <p>{useToday(() => new Date())}</p>;
    }
    const screen = await render(<Today />);
    await expect.element(screen.locator).toHaveTextContent("2026-10-05");

    await vi.advanceTimersByTimeAsync(60_000);
    await expect.element(screen.locator).toHaveTextContent("2026-10-06");
    // And again the next night, from the timer set at the first midnight.
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    await expect.element(screen.locator).toHaveTextContent("2026-10-07");
  } finally {
    vi.useRealTimers();
  }
});

test("shows each plan's account only once accounts are told apart", async () => {
  const SUB = "acc00000-0000-4000-8000-000000000002";
  const plans = [
    plan(PLAN_A, "メインのプラン", "2026-10-01T00:00:00.000Z", 1),
    { ...plan(PLAN_B, "家族のプラン", "2026-10-05T00:00:00.000Z", 1), accountId: SUB },
  ];
  const profile = {
    accounts: [defaultAccount(), { id: SUB, name: "家族" }],
    updatedAt: "2026-10-05T00:00:00.000Z",
  };

  const off = createMemoryRepository({ shops: [shop], plans, profile });
  const { screen } = await renderTopPage(off);
  await expect.element(screen.getByRole("link", { name: /家族のプラン/ })).toBeVisible();
  await expectTexts(planRows(), [
    "家族のプラン10/1〜10/31・1店舗・1件200P",
    "メインのプラン10/1〜10/31・1店舗・1件200P",
  ]);

  const on = createMemoryRepository({
    shops: [shop],
    plans,
    profile: { ...profile, multiAccount: true },
  });
  await renderTopPage(on);
  await expectTexts(planRows(), [
    "家族のプラン家族・10/1〜10/31・1店舗・1件200P",
    "メインのプランメイン・10/1〜10/31・1店舗・1件200P",
  ]);
});

test("names the tool in the top heading", async () => {
  const { screen } = await renderTopPage(createMemoryRepository());
  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "楽天お買い物マラソンのポイント計算ツール" }),
    )
    .toBeVisible();
});

test("starts a plan for the one event running", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderTopPage(repository);
  // Wait for the events: until they load, the button only leads to the list.
  await expect.element(screen.getByText("開催中")).toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.officialEventId).toBe("marathon-2026-10");
});

test("asks before starting a plan whose name is taken", async () => {
  const repository = createMemoryRepository({
    plans: [plan(PLAN_A, "10月 お買い物マラソン&ジャンル祭", "2026-10-01T00:00:00.000Z", 0)],
  });
  const { screen } = await renderTopPage(repository);
  await expect.element(screen.getByText("開催中")).toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  await expect
    .element(screen.getByRole("dialog", { name: "同じ名前のプランがあります" }))
    .toBeVisible();
  expect(await repository.plans.list()).toHaveLength(1);
});

test("takes the visitor to the events when two are running", async () => {
  const repository = createMemoryRepository();
  const second = marathon({
    id: "marathon-2026-10-second",
    name: "お買い物マラソン別枠",
    start: "2026-10-04",
    end: "2026-10-09",
  });
  const { screen, router } = await renderTopPage(repository, {
    events: { load: async () => [servedEvents[1] as OfficialEvent, second] },
  });
  await expect.element(screen.getByText("お買い物マラソン別枠")).toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  await expect.element(screen.getByRole("heading", { name: "イベント" })).toHaveFocus();
  expect(router.state.location.pathname).toBe("/");
  expect(await repository.plans.list()).toHaveLength(0);
});

test("opens the tab of the running events when the visitor is taken to choose one", async () => {
  const second = marathon({
    id: "marathon-2026-10-second",
    name: "お買い物マラソン別枠",
    start: "2026-10-04",
    end: "2026-10-09",
  });
  const { screen } = await renderTopPage(createMemoryRepository(), {
    events: { load: async () => [...servedEvents.slice(0, 2), second] },
  });
  await screen.getByRole("tab", { name: "終了" }).click();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  await expect
    .element(screen.getByRole("tab", { name: "開催中・開催予定" }))
    .toHaveAttribute("aria-selected", "true");
  await expect.element(screen.getByText("お買い物マラソン別枠")).toBeVisible();
});

test("does not start a plan from events kept from before a read that failed", async () => {
  const repository = createMemoryRepository();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let fail = false;
  const { screen, router } = await renderTopPage(repository, {
    client,
    events: {
      load: async () => {
        if (fail) throw new Error("offline");
        return servedEvents;
      },
    },
  });
  await expect.element(screen.getByText("お買い物マラソン&ジャンル祭")).toBeVisible();
  fail = true;
  await client.refetchQueries();
  await expect
    .element(screen.getByRole("tabpanel").getByText("イベントを読み込めませんでした"))
    .toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  expect(router.state.location.pathname).toBe("/");
  expect(await repository.plans.list()).toHaveLength(0);
});

test("takes the visitor to the events while they cannot be read", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderTopPage(repository, {
    events: {
      load: async () => {
        throw new Error("offline");
      },
    },
  });
  await expect
    .element(screen.getByRole("tabpanel").getByText("イベントを読み込めませんでした"))
    .toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  expect(router.state.location.pathname).toBe("/");
  expect(await repository.plans.list()).toHaveLength(0);
});

test("starts a plan for the same ended event the list shows when none is ahead", async () => {
  const repository = createMemoryRepository();
  // Both ended on the same day: the one that started later is the latest.
  const longer = marathon({
    id: "marathon-2026-09-a",
    name: "お買い物マラソン長め",
    start: "2026-09-15",
    end: "2026-09-24",
  });
  const shorter = marathon({
    id: "marathon-2026-09-b",
    name: "お買い物マラソン短め",
    start: "2026-09-19",
    end: "2026-09-24",
  });
  const { screen, router } = await renderTopPage(repository, {
    events: { load: async () => [longer, shorter] },
  });
  const shown = screen.getByRole("listitem").filter({ hasText: "この条件で計算してみる" });
  await expect.element(shown.getByText("お買い物マラソン短め")).toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.officialEventId).toBe("marathon-2026-09-b");
});

test("shows next to the start button that the plan it started cannot be saved", async () => {
  const repository = createMemoryRepository();
  repository.plans.update = () => Promise.reject(new Error("quota"));
  const { screen, router } = await renderTopPage(repository);
  await expect.element(screen.getByText("開催中")).toBeVisible();

  await screen.getByRole("button", { name: "計算をはじめる" }).click();

  const hero = screen.getByRole("region", { name: "楽天お買い物マラソンのポイント計算ツール" });
  await expect
    .element(hero.getByRole("alert"))
    .toHaveTextContent("プランを作れませんでした。もう一度お試しください。");
  expect(screen.getByRole("alert").elements()).toHaveLength(1);
  expect(router.state.location.pathname).toBe("/");
});
