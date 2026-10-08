import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { type Benefit, type Order, type Plan, type Shop, officialEvents } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { repositoryAtom } from "../../state/repository";
import { createMemoryRepository } from "../../storage/memory-repository";
import type { Repository } from "../../storage/repository";
import { TestColorMode } from "../../test-color-mode";
import { PlanHome } from "./plan-home";

const PLAN = "f0000000-0000-4000-8000-00000000000a";
const OTHER_PLAN = "f0000000-0000-4000-8000-00000000000b";

const shopId = (index: number) =>
  `a0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`;

const shops: Shop[] = Array.from({ length: 12 }, (_, index) => ({
  id: shopId(index),
  channel: "rakuten-ichiba",
  name: `ショップ${index}`,
  tags: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
}));

const baseBenefit: Benefit = {
  id: "b0000000-0000-4000-8000-000000000001",
  kind: "rate-bonus",
  category: "base",
  label: "通常ポイント",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { rate: 1, roundingUnit: "item" },
};

const spuBenefit: Benefit = {
  ...baseBenefit,
  id: "b0000000-0000-4000-8000-000000000002",
  category: "spu",
  label: "SPU",
  params: { rate: 2, roundingUnit: "item" },
};

/** The October marathon: +3倍 at 4 shops, up to +9倍 at 10 shops, capped at 7,000P. */
const marathon = officialEvents[0]?.benefits ?? [];

const order = (
  index: number,
  options: { onHold?: boolean; shopPointRate?: number } = {},
): Order => ({
  id: `0${String(index).padStart(2, "0")}00000-0000-4000-8000-000000000000`,
  shopId: shopId(index),
  date: "2026-10-05",
  lineItems: [
    {
      id: `0${String(index).padStart(2, "0")}00000-0000-4000-8000-000000000001`,
      name: "item",
      unitPrice: 10000,
      quantity: 1,
      taxRate: 0,
      discount: 0,
      ...(options.shopPointRate === undefined ? {} : { shopPointRate: options.shopPointRate }),
    },
  ],
  onHold: options.onHold ?? false,
  tags: [],
});

const makePlan = (input: {
  id?: string;
  name?: string;
  benefits: Benefit[];
  orders: Order[];
}): Plan => ({
  id: input.id ?? PLAN,
  name: input.name ?? "10月 お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: input.benefits,
  orders: input.orders,
  updatedAt: "2026-10-05T00:00:00.000Z",
});

/**
 * Four counted shops of ¥10,000 (tax-exempt, so the target is ¥10,000 either way) and one held
 * order. Points: 通常 400 + SPU 800 + マラソン 1,200 (+3倍) + キャンペーン 200 (shop +3倍 on one
 * item) = 2,600P on ¥40,000 = 6.5%.
 */
const marathonPlan = () =>
  makePlan({
    benefits: [baseBenefit, spuBenefit, ...marathon],
    orders: [
      order(0, { shopPointRate: 3 }),
      order(1),
      order(2),
      order(3),
      order(4, { onHold: true }),
    ],
  });

function Hydrate({ repository, children }: { repository: Repository; children: ReactNode }) {
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

async function renderPlanHome(
  repository: Repository,
  options: { id?: string; colorMode?: "light" | "dark" } = {},
) {
  await cleanup();
  const id = options.id ?? PLAN;
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <p>プランの一覧画面</p>,
  });
  const planRoute = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <PlanHome id={id} />,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => root,
    path: "/plan/settings",
    component: () => <p>プランの設定画面</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, planRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: [`/plan?id=${id}`] }),
  });
  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <TestColorMode value={options.colorMode ?? "light"} />
      <QueryClientAtomProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Hydrate repository={repository}>
          <RouterProvider router={router} />
        </Hydrate>
      </QueryClientAtomProvider>
    </UIProvider>,
  );
  return { screen, router };
}

const summary = () => document.querySelector<HTMLElement>('section[aria-label="サマリー"]');
const summaryText = () => summary()?.textContent ?? "";

test("shows total and effective rate", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  await renderPlanHome(repository);

  await expect.poll(summaryText).toContain("獲得予定2,600P");
  // The held order's ¥10,000 is not part of the denominator.
  expect(summaryText()).toContain("実質還元率6.5%");
  expect(summaryText()).toContain("4店舗を買い回り中");
  expect(summaryText()).toContain("マラソン +3倍");
  // The cap left for this plan is the whole 7,000P; ¥193,334 more (tax-excluded) reaches it.
  expect(summaryText()).toContain("1,200 / 7,000P");
  expect(summaryText()).toContain("上限まであと 約21.3万円 買えます");
  const dots = summary()?.querySelector('[aria-label="買い回り 10店舗中4店舗"]');
  expect(dots?.children).toHaveLength(10);

  const bar = document.querySelector<HTMLElement>('[aria-label="合計"]');
  expect(bar?.textContent).toContain("¥40,000・4店舗");
  expect(bar?.textContent).toContain("2,600P");
  expect(bar?.textContent).toContain("6.5%");
});

test("shows next shop hint only below the top tier", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const { screen } = await renderPlanHome(repository);

  // +3倍 → +4倍 on ¥40,000 is 400P more.
  await expect.element(screen.getByText("あと1店舗で全商品", { exact: false })).toBeVisible();
  expect(summaryText()).toContain("あと1店舗で全商品 +1倍（約 +400P）");

  const topTier = makePlan({
    benefits: [baseBenefit, ...marathon],
    orders: Array.from({ length: 10 }, (_, index) => order(index)),
  });
  await renderPlanHome(createMemoryRepository({ shops, plans: [topTier] }));

  await expect.poll(summaryText).toContain("10店舗を買い回り中");
  expect(summaryText()).not.toContain("あと1店舗で");
});

test("breakdown opens and sums to total", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const { screen } = await renderPlanHome(repository);

  const toggle = screen.getByRole("button", { name: "ポイントの内訳を見る" });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(summaryText).toContain("2,600P");
  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");

  const legend = screen.getByRole("list", { name: "ポイントの内訳" });
  await expect.element(legend).toBeVisible();
  const items = Array.from(legend.element().querySelectorAll("li")).map((li) => li.textContent);
  expect(items).toEqual(["通常400P", "SPU800P", "マラソン1,200P", "キャンペーン200P"]);
  const sum = items.reduce((total, text) => total + Number(text?.replace(/\D/g, "")), 0);
  expect(sum).toBe(2600);

  await toggle.click();
  await expect.element(legend).not.toBeInTheDocument();
});

test("hides shop-around parts when the plan has none", async () => {
  const plan = makePlan({ benefits: [baseBenefit, spuBenefit], orders: [order(0), order(1)] });
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.poll(summaryText).toContain("獲得予定600P");
  expect(summaryText()).toContain("実質還元率3.0%");
  expect(summary()?.querySelector('[aria-label^="買い回り"]')).toBeNull();
  expect(summaryText()).not.toContain("店舗を買い回り中");
  expect(summaryText()).not.toContain("あと1店舗で");
  expect(summaryText()).not.toContain("上限");
  expect(document.body.textContent).not.toContain("あと何店舗回る？");
});

test("shows warnings for orders outside the period and unknown shops", async () => {
  const outside = { ...order(1), date: "2026-10-11" };
  const unknown = { ...order(2), shopId: "a0000000-0000-4000-8000-0000000000ff" };
  const plan = makePlan({
    benefits: [baseBenefit, ...marathon],
    orders: [order(0), outside, unknown],
  });
  const { screen } = await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect
    .element(screen.getByText("期間外の注文が1件あります（10/11）。", { exact: false }))
    .toBeVisible();
  await expect
    .element(screen.getByText("台帳にないショップの注文が1件あります。", { exact: false }))
    .toBeVisible();
});

test("switches to another plan from the header", async () => {
  const other = makePlan({ id: OTHER_PLAN, name: "10月の普段の買い物", benefits: [], orders: [] });
  const repository = createMemoryRepository({ shops, plans: [marathonPlan(), other] });
  const { screen, router } = await renderPlanHome(repository);

  // The accessible name starts with the plan name the button shows.
  const switcher = screen.getByRole("button", {
    name: "10月 お買い物マラソン、プランを切り替える",
    exact: true,
  });
  await expect.element(switcher).toBeVisible();
  await switcher.click();
  await screen.getByRole("menuitem", { name: "10月の普段の買い物" }).click();
  await expect.poll(() => router.state.location.search).toEqual({ id: OTHER_PLAN });

  await expect.element(screen.getByRole("link", { name: /プランの設定/ })).toBeVisible();
});

test("says so when the plan does not exist", async () => {
  const { screen, router } = await renderPlanHome(createMemoryRepository({ shops }), {
    id: "f0000000-0000-4000-8000-0000000000ff",
  });

  await expect.element(screen.getByText("プランが見つかりません")).toBeVisible();
  await screen.getByRole("link", { name: "プランの一覧へ" }).click();
  await expect.poll(() => router.state.location.pathname).toBe("/");
});

test.each([
  ["light", "rgb(191, 0, 0)"],
  ["dark", "rgb(163, 0, 0)"],
] as const)("paints the summary card in %s mode", async (colorMode, expected) => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  await renderPlanHome(repository, { colorMode });

  await expect.poll(summaryText).toContain("2,600P");
  await expect
    .poll(() => getComputedStyle(summary() as HTMLElement).backgroundColor)
    .toBe(expected);
});

test("shows nothing until the shops have loaded", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  repository.shops.list = () => new Promise<Shop[]>(() => {});
  const { screen } = await renderPlanHome(repository);

  await expect.element(screen.getByText("読み込み中…")).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(summary()).toBeNull();
  expect(document.body.textContent).not.toContain("台帳にないショップ");
});

test("offers a retry when the shops cannot be read", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const list = repository.shops.list.bind(repository.shops);
  let fail = true;
  repository.shops.list = () => (fail ? Promise.reject(new Error("broken")) : list());
  const { screen } = await renderPlanHome(repository);

  await expect.element(screen.getByText("保存されたデータを読み込めませんでした。")).toBeVisible();
  expect(summary()).toBeNull();
  expect(document.body.textContent).not.toContain("台帳にないショップ");

  fail = false;
  await screen.getByRole("button", { name: "もう一度読み込む" }).click();
  await expect.poll(summaryText).toContain("獲得予定2,600P");
  expect(document.body.textContent).not.toContain("台帳にないショップ");
});

test("says the cap is reached when nothing is left to buy", async () => {
  // ¥240,000 at +3倍 is 7,200P, over the 7,000P cap.
  const big = (index: number): Order => {
    const base = order(index);
    return { ...base, lineItems: base.lineItems.map((item) => ({ ...item, unitPrice: 60000 })) };
  };
  const plan = makePlan({ benefits: [baseBenefit, ...marathon], orders: [0, 1, 2, 3].map(big) });
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.poll(summaryText).toContain("上限に達しました");
  expect(summaryText()).not.toContain("上限まであと");
});
