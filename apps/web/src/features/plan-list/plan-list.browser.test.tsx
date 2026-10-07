import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { Plan, Shop } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { userEvent } from "vitest/browser";
import { expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { repositoryAtom } from "../../state/repository";
import { createMemoryRepository } from "../../storage/memory-repository";
import type { Repository } from "../../storage/repository";
import { TestColorMode } from "../../test-color-mode";
import { PlanList, useToday } from "./plan-list";

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

/** The same providers as `AppProviders`, with a repository the test holds on to. */
function TestProviders({ repository, children }: { repository: Repository; children: ReactNode }) {
  const client = new QueryClient();
  return (
    <QueryClientAtomProvider client={client}>
      <Hydrate repository={repository}>{children}</Hydrate>
    </QueryClientAtomProvider>
  );
}

function Hydrate({ repository, children }: { repository: Repository; children: ReactNode }) {
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

/**
 * The screen runs in a router with a memory history, so links and `navigate` are the real ones
 * and the test reads where they ended up.
 */
async function renderPlanList(
  repository: Repository,
  options: { colorMode?: "light" | "dark" } = {},
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <PlanList now={now} />,
  });
  const planRoute = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <p>プラン画面</p>,
  });
  const profileRoute = createRoute({
    getParentRoute: () => root,
    path: "/profile",
    component: () => <p>プロフィール画面</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, planRoute, profileRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <TestColorMode value={options.colorMode ?? "light"} />
      <TestProviders repository={repository}>
        <RouterProvider router={router} />
      </TestProviders>
    </UIProvider>,
  );
  return { screen, router };
}

test("creates a plan from an official event and navigates to it", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderPlanList(repository);

  await expect.element(screen.getByText("開催中")).toBeVisible();
  await expect
    .element(screen.getByText("・買いまわり最大 +9倍・上限 7,000P", { exact: false }))
    .toBeVisible();
  await screen.getByRole("button", { name: "このイベントでプランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created, ...rest] = await repository.plans.list();
  expect(rest).toEqual([]);
  expect(created?.name).toBe("10月 お買い物マラソン&ジャンル祭");
  expect(created?.officialEventId).toBe("marathon-2026-10");
  expect(created?.period).toEqual({ start: "2026-10-04", end: "2026-10-09" });
  expect(router.state.location.search).toEqual({ id: created?.id });
});

test("creates a plan without an event", async () => {
  const repository = createMemoryRepository();
  const { screen, router } = await renderPlanList(repository);

  await screen.getByRole("button", { name: "イベントを選ばずにプランを作る" }).click();

  await expect.poll(() => router.state.location.pathname).toBe("/plan");
  const [created] = await repository.plans.list();
  expect(created?.name).toBe("10月の買い物");
  expect(created?.officialEventId).toBeUndefined();
  expect(created?.period).toEqual({ start: "2026-10-05", end: "2026-10-05" });
  expect(router.state.location.search).toEqual({ id: created?.id });
});

test("lists plans with their totals", async () => {
  const repository = createMemoryRepository({
    shops: [shop],
    plans: [
      plan(PLAN_A, "10月の普段の買い物", "2026-10-01T00:00:00.000Z", 1),
      plan(PLAN_B, "10月 お買い物マラソン", "2026-10-05T00:00:00.000Z", 2),
    ],
  });
  const { screen, router } = await renderPlanList(repository);

  await expect.element(screen.getByRole("link", { name: /10月 お買い物マラソン/ })).toBeVisible();
  // Most recently updated first. The shops load after the plans, so wait for the totals.
  const rowTexts = () =>
    Array.from(document.querySelectorAll("section:last-of-type li")).map((row) => row.textContent);
  await expect
    .poll(rowTexts)
    .toEqual([
      "10月 お買い物マラソン10/1〜10/31・1店舗・2件200P",
      "10月の普段の買い物10/1〜10/31・1店舗・1件100P",
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
  const { screen } = await renderPlanList(repository);

  await screen.getByRole("button", { name: "消すプランを削除" }).click();
  await screen.getByRole("button", { name: "キャンセル" }).click();
  expect(await repository.plans.list()).toHaveLength(1);
  await expect.element(screen.getByRole("link", { name: /消すプラン/ })).toBeVisible();

  await screen.getByRole("button", { name: "消すプランを削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();

  await expect.element(screen.getByRole("link", { name: /消すプラン/ })).not.toBeInTheDocument();
  await expect.poll(async () => repository.plans.list()).toEqual([]);
});

test("shows an error and stays put when the plan cannot be saved", async () => {
  const repository = createMemoryRepository();
  repository.plans.put = () => Promise.reject(new Error("quota"));
  const { screen, router } = await renderPlanList(repository);

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
  const { screen } = await renderPlanList(repository);
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
  await expect.poll(() => document.activeElement?.textContent).toBe("プラン");
});

test.each(["light", "dark"] as const)("renders the screen in %s mode", async (colorMode) => {
  const repository = createMemoryRepository({
    shops: [shop],
    plans: [plan(PLAN_A, "プラン", "2026-10-01T00:00:00.000Z", 1)],
  });
  const { screen } = await renderPlanList(repository, { colorMode });

  await expect.element(screen.getByRole("link", { name: /プラン/ })).toBeVisible();
  const page = document.querySelector("main")?.parentElement?.parentElement;
  const expected = colorMode === "light" ? "rgb(245, 245, 245)" : "rgb(18, 18, 18)";
  await expect.poll(() => (page ? getComputedStyle(page).backgroundColor : "")).toBe(expected);
});

test("today moves on at midnight in Japan", async () => {
  await cleanup();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  try {
    // 23:59 on 10/5 in Japan.
    vi.setSystemTime(new Date("2026-10-05T14:59:00Z"));
    function Today() {
      return <p data-testid="today">{useToday(() => new Date())}</p>;
    }
    const screen = await render(<Today />);
    const today = () => screen.container.querySelector('[data-testid="today"]')?.textContent;
    expect(today()).toBe("2026-10-05");

    await vi.advanceTimersByTimeAsync(60_000);
    expect(today()).toBe("2026-10-06");
    // And again the next night, from the timer set at the first midnight.
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(today()).toBe("2026-10-07");
  } finally {
    vi.useRealTimers();
  }
});
