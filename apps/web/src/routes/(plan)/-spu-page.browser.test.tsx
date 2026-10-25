import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  DEFAULT_ACCOUNT_ID,
  type Plan,
  type SpuMonth,
  spuIdsIn,
  spuMonthId,
  standardSpu,
} from "@workspaces/domain";
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "../../storage/memory-repository";
import { PLAN, Providers, makePlan, order, shops, tapCard } from "./-test-fixtures";
import { SpuPage } from "./-spu-page";

beforeEach(async () => {
  await page.viewport(390, 844);
  // Today is 10/6.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
});

const spuId = (label: string): string => {
  const benefit = standardSpu.find((candidate) => candidate.label === label);
  if (!benefit) throw new Error(`no SPU ${label}`);
  return benefit.id;
};

/** The SPU of the default account in `month`, with the items of `labels` on. */
const spuMonth = (labels: string[], month = "2026-10"): SpuMonth => ({
  id: spuMonthId(DEFAULT_ACCOUNT_ID, month),
  accountId: DEFAULT_ACCOUNT_ID,
  month,
  enabledIds: labels.map(spuId),
  updatedAt: "2026-10-05T00:00:00.000Z",
});

let currentRepository: ReturnType<typeof createMemoryRepository> | undefined;
/** Whether the item of `label` is on in the stored SPU of the default account's `month`. */
const storedOn = async (label: string, month = "2026-10") => {
  if (!currentRepository) throw new Error("no repository");
  return spuIdsIn(await currentRepository.spuMonths.list(), DEFAULT_ACCOUNT_ID, month).has(
    spuId(label),
  );
};

function SpuRoute() {
  const { month, account } = useSearch({ strict: false }) as { month?: string; account?: string };
  return <SpuPage month={month} account={account} />;
}

/**
 * The SPU page of `month`: opened from the plan when `plan` is given (the history state), and
 * otherwise from 共通設定.
 */
async function renderSpu({
  month = "2026-10",
  plans = [],
  spuMonths = [],
  fromPlan = false,
}: { month?: string; plans?: Plan[]; spuMonths?: SpuMonth[]; fromPlan?: boolean } = {}) {
  currentRepository = createMemoryRepository({ shops, plans, spuMonths });
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const routes = [
    createRoute({ getParentRoute: () => root, path: "/plan", component: () => <h1>プラン</h1> }),
    createRoute({
      getParentRoute: () => root,
      path: "/profile",
      component: () => <h1>共通設定</h1>,
    }),
    createRoute({ getParentRoute: () => root, path: "/spu", component: SpuRoute }),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/profile"] }),
  });
  const screen = await render(
    <Providers repository={currentRepository}>
      <RouterProvider router={router} />
    </Providers>,
  );
  await router.navigate({
    to: "/spu",
    search: { month },
    state: fromPlan ? { spuFrom: { planId: PLAN } } : {},
  });
  return Object.assign(screen, { router });
}

type Screen = Awaited<ReturnType<typeof renderSpu>>;
const spuSection = (screen: Screen) => screen.getByRole("region", { name: "SPU" });

test("a tile toggles the month's SPU and the rate", async () => {
  const screen = await renderSpu();
  await expect.element(screen.getByRole("heading", { name: "10月の SPU" })).toBeVisible();
  const mobile = screen.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  await expect
    .element(spuSection(screen).getByRole("img", { name: "楽天モバイル", exact: true }))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/spu/service_mobile_v2.webp");
  await expect.element(mobile).not.toBeChecked();
  await expect.element(spuSection(screen)).toMatchTextContent("ポイント倍率1倍");
  // 通常ポイント is not a tile; 楽天カード通常分 is, under a short name.
  expect(screen.getByRole("checkbox", { name: /^通常ポイント/ }).query()).toBeNull();

  await tapCard(mobile);
  await expect.element(mobile).toBeChecked();
  await expect.element(spuSection(screen)).toMatchTextContent("ポイント倍率5倍");
  await expect.element(spuSection(screen)).toMatchTextContent("SPU +4倍");
  await expect.poll(() => storedOn("楽天モバイル")).toBe(true);

  // The card's own normal points count as 通常, not as SPU. Turning them on also turns on the
  // card's SPU bonus, which requires them.
  await tapCard(screen.getByRole("checkbox", { name: "楽天カード（通常） +1倍" }));
  await expect.element(spuSection(screen)).toMatchTextContent("ポイント倍率7倍");
  await expect.element(spuSection(screen)).toMatchTextContent("通常 2倍");
  await expect
    .element(screen.getByRole("checkbox", { name: "楽天カード特典分（SPU） +1倍" }))
    .toBeChecked();

  // A tile is a checkbox, so Space toggles the focused tile.
  (mobile.element() as HTMLElement).focus();
  await userEvent.keyboard(" ");
  await expect.element(mobile).not.toBeChecked();
  await expect.poll(() => storedOn("楽天モバイル")).toBe(false);
});

test("the items are grouped into those carried to the next month and those met each month", async () => {
  const screen = await renderSpu();
  const carried = screen.getByRole("group", { name: "契約・お支払いで決まる" });
  const monthly = screen.getByRole("group", { name: "その月の利用で決まる" });
  await expect.element(carried.getByRole("checkbox", { name: "楽天モバイル +4倍" })).toBeVisible();
  await expect
    .element(monthly.getByRole("checkbox", { name: "楽天ブックス +0.5倍" }))
    .toBeVisible();
  expect(carried.getByRole("checkbox", { name: "楽天ブックス +0.5倍" }).query()).toBeNull();
});

test("enabling the premium card turns off the regular card, and turns the normal points on with it", async () => {
  const screen = await renderSpu({
    spuMonths: [spuMonth(["楽天カード通常分（カード本体の還元）", "楽天カード特典分（SPU）"])],
  });
  const card = screen.getByRole("checkbox", { name: "楽天カード特典分（SPU） +1倍" });
  const premium = screen.getByRole("checkbox", { name: "楽天プレミアムカード（特典分） +1倍" });
  const normal = screen.getByRole("checkbox", { name: "楽天カード（通常） +1倍" });
  await expect.element(card).toBeChecked();

  await tapCard(premium);
  await expect.element(premium).toBeChecked();
  await expect.element(card).not.toBeChecked();
  await expect.element(normal).toBeChecked();
  await expect
    .poll(async () => [
      await storedOn("楽天カード特典分（SPU）"),
      await storedOn("楽天プレミアムカード（特典分）"),
    ])
    .toEqual([false, true]);

  await tapCard(premium);
  await expect.element(normal).not.toBeChecked();
  await expect.poll(() => storedOn("楽天カード通常分（カード本体の還元）")).toBe(false);
});

test("opened from a plan, the badge marks the items that reached their cap in the plan", async () => {
  // ¥10,000 before tax per item: +0.5倍 gives 50P per item, so ten items reach the 500P cap.
  const plan = makePlan([], [order(0, { items: 5 }), order(1, { items: 5 })]);
  const screen = await renderSpu({
    plans: [plan],
    spuMonths: [spuMonth(["楽天ブックス"])],
    fromPlan: true,
  });
  const books = screen.getByRole("checkbox", { name: "楽天ブックス +0.5倍" });
  await expect.element(books).toHaveAccessibleDescription("上限");
  await expect
    .element(screen.getByRole("checkbox", { name: "楽天Kobo +0.5倍" }))
    .not.toHaveAccessibleDescription();

  // The name opens the cap and the conditions.
  await screen.getByRole("button", { name: "楽天ブックスの上限と条件" }).click();
  const detail = screen.getByRole("dialog", { name: "楽天ブックス" });
  await expect.element(detail.getByText("月間上限 500P")).toBeVisible();
  await expect.element(detail.getByText("このプランで上限に達しています")).toBeVisible();
  await expect
    .element(detail.getByRole("link", { name: /楽天で自分のSPUを確認する/ }))
    .toHaveAttribute("href", "https://event.rakuten.co.jp/campaign/point-up/everyday/point/");
});

test("lists the plans the month's SPU is used by, folded", async () => {
  const crossing: Plan = {
    ...makePlan([], [order(0), { ...order(1), date: "2026-11-02" }]),
    name: "10月末マラソン",
    period: { start: "2026-10-28", end: "2026-11-02" },
  };
  const screen = await renderSpu({ month: "2026-11", plans: [crossing] });
  await screen.getByText("この SPU で計算するプラン 1件").click();
  await expect
    .element(screen.getByRole("list", { name: "この SPU で計算するプラン" }))
    .toMatchTextContent("10月末マラソン（10/28〜11/2）11月の注文 1件");
});

test("opened from a plan of two months, it switches between them and goes back to the plan", async () => {
  const plan: Plan = {
    ...makePlan([], [order(0)]),
    name: "10月末マラソン",
    period: { start: "2026-10-25", end: "2026-11-03" },
  };
  const screen = await renderSpu({
    plans: [plan],
    spuMonths: [spuMonth(["楽天モバイル", "楽天ブックス"])],
    fromPlan: true,
  });
  const mobile = screen.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  const books = screen.getByRole("checkbox", { name: "楽天ブックス +0.5倍" });
  await expect.element(mobile).toBeChecked();
  // A plan gives its months to pick, not a month at a time.
  expect(screen.getByRole("button", { name: "11月の SPU" }).query()).toBeNull();

  // November is not set yet: it takes the contract of October, and not what is met each month.
  await screen
    .getByRole("radiogroup", { name: "SPU の月" })
    .getByText("11月", { exact: true })
    .click();
  await expect.element(screen.getByRole("heading", { name: "11月の SPU" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ month: "2026-11" });
  await expect.element(mobile).toBeChecked();
  await expect.element(books).not.toBeChecked();

  await tapCard(mobile);
  await expect.poll(() => storedOn("楽天モバイル", "2026-11")).toBe(false);
  expect(await storedOn("楽天モバイル", "2026-10")).toBe(true);

  await screen.getByRole("link", { name: "10月末マラソンに戻る" }).first().click();
  await expect.element(screen.getByRole("heading", { name: "プラン" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ id: PLAN });
});

test("opened from 共通設定 or directly, it steps a month at a time and goes back to 共通設定", async () => {
  const screen = await renderSpu({ month: "2026-12" });
  await expect.element(screen.getByRole("heading", { name: "12月の SPU" })).toBeVisible();
  await screen.getByRole("button", { name: "2027年1月の SPU" }).click();
  await expect.element(screen.getByRole("heading", { name: "2027年1月の SPU" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ month: "2027-01" });

  await screen.getByRole("link", { name: "共通設定に戻る" }).first().click();
  await expect.element(screen.getByRole("heading", { name: "共通設定" })).toBeVisible();
});
