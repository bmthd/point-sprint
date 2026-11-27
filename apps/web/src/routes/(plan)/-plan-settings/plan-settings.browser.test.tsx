import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  type Benefit,
  DEFAULT_ACCOUNT_ID,
  type OfficialEvent,
  type Plan,
  type Profile,
  type Shop,
  type SpuMonth,
  campaignTemplates,
  createPlan,
  defaultAccount,
  spuIdsIn,
  spuMonthId,
  standardSpu,
} from "@workspaces/domain";
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import { misalignedFields } from "#/test-layout.ts";
import {
  PLAN,
  Providers,
  makePlan,
  marathon,
  order,
  renderPlanHome,
  shops,
  tapCard,
} from "#/routes/(plan)/-test-fixtures.tsx";
import { PlanSettings } from "./plan-settings.tsx";

beforeEach(async () => {
  await page.viewport(390, 844);
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

/** A plan of October, whose SPU is the month's: only 通常ポイント is on until the user turns more on. */
const spuPlan = (benefits: Benefit[] = [], orders = [order(0)]) => makePlan(benefits, orders);

let currentRepository: ReturnType<typeof createMemoryRepository> | undefined;
const repository = () => {
  if (!currentRepository) throw new Error("no repository");
  return currentRepository;
};
const storedPlan = async () => {
  const plan = await repository().plans.get(PLAN);
  if (!plan) throw new Error("no plan");
  return plan;
};
const storedBenefit = async (label: string) =>
  (await storedPlan()).benefits.find((benefit) => benefit.label === label);
/** Whether the item of `label` is on in the stored SPU of the default account's `month`. */
const storedOn = async (label: string, month = "2026-10") =>
  spuIdsIn(await repository().spuMonths.list(), DEFAULT_ACCOUNT_ID, month).has(spuId(label));

async function renderSettings(
  plan: Plan,
  profile?: Profile,
  spuMonths: SpuMonth[] = [],
  events?: OfficialEvent[],
  shopList: Shop[] = shops,
) {
  currentRepository = createMemoryRepository({
    shops: shopList,
    plans: [plan],
    profile,
    spuMonths,
  });
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <h1>プランのホーム</h1>,
  });
  const settings = createRoute({
    getParentRoute: () => root,
    path: "/plan/settings",
    component: () => <PlanSettings id={PLAN} />,
  });
  const spu = createRoute({
    getParentRoute: () => root,
    path: "/spu",
    component: () => <h1>月の SPU</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, settings, spu]),
    history: createMemoryHistory({ initialEntries: [`/plan/settings?id=${PLAN}`] }),
  });
  const screen = await render(
    <Providers repository={currentRepository} events={events}>
      <RouterProvider router={router} />
    </Providers>,
  );
  await expect.element(screen.getByRole("heading", { name: "プランの設定" })).toBeVisible();
  return Object.assign(screen, { router });
}

type Screen = Awaited<ReturnType<typeof renderSettings>>;

const spuSection = (screen: Screen) => screen.getByRole("region", { name: "SPU" });

test("campaigns show the image from their master data", async () => {
  const pointDay = structuredClone(
    campaignTemplates.find((template) => template.id === "pointday")?.benefit,
  );
  if (!pointDay) throw new Error("no pointday campaign");
  const screen = await renderSettings(makePlan([pointDay], []));

  await expect
    .element(screen.getByRole("img", { name: "5と0のつく日" }))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/campaign/pointday.webp");

  const campaign = screen
    .getByRole("region", { name: "キャンペーン" })
    .getByRole("switch", { name: "5と0のつく日 +1倍 毎月5・10・15・20・25・30日" });
  const campaignSection = screen.getByRole("region", { name: "キャンペーン" });
  await expect.element(campaignSection.getByText("OFF", { exact: true })).toBeVisible();
  await tapCard(campaign);
  await expect.element(campaignSection.getByText("ON", { exact: true })).toBeVisible();

  // The button's image has no alt text, being named by the button.
  await expect
    .element(screen.getByRole("button", { name: "勝ったら倍を追加" }).getByRole("presentation"))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/campaign/sports.webp");
});

/** Today is 10/6, inside the plan's period (10/4 to 10/9). */
const onOctober6 = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
};

const pointDay = () => {
  const benefit = campaignTemplates.find((template) => template.id === "pointday")?.benefit;
  if (!benefit) throw new Error("no pointday campaign");
  return structuredClone(benefit);
};

test("adds a sports-win day at once, and changes it in its row", async () => {
  onOctober6();
  const screen = await renderSettings(makePlan([pointDay()], []));
  await screen.getByRole("button", { name: "勝ったら倍を追加" }).click();

  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(2);
  expect((await storedPlan()).benefits[1]).toMatchObject({
    label: "勝ったら倍",
    enabled: true,
    conditions: { dateRule: { type: "dates", dates: ["2026-10-06"] } },
    params: { rate: 1 },
  });
  // The campaign just added opens its values.
  const edit = screen.getByRole("button", { name: "勝ったら倍を編集" });
  await expect.element(edit).toHaveAttribute("aria-expanded", "true");
  const date = screen.getByLabelText("日付");
  await expect.element(date).toHaveValue("2026/10/06");

  // The switch of every row is in the same place, whether the row has ✎ or not. Positions are
  // read from the elements: no matcher measures them.
  const switchOf = (name: RegExp) =>
    screen.getByRole("switch", { name }).element().getBoundingClientRect();
  expect(switchOf(/^勝ったら倍/).left).toBe(switchOf(/^5と0のつく日/).left);

  await screen.getByText("両方のチームが勝った日").click();
  await expect
    .poll(async () => (await storedPlan()).benefits[1]?.imagePath)
    .toBe("/img/campaign/sports-w.webp");
  await date.fill("2026/10/07");
  await userEvent.keyboard("{Enter}");
  const toggle = screen.getByRole("switch", { name: "勝ったら倍 +2倍 10/7" });
  await expect.element(toggle).toBeChecked();
  expect((await storedPlan()).benefits[1]?.conditions.dateRule).toEqual({
    type: "dates",
    dates: ["2026-10-07"],
  });

  await tapCard(toggle);
  await expect.poll(async () => (await storedPlan()).benefits[1]?.enabled).toBe(false);

  // An added campaign can be deleted after a confirmation.
  await screen.getByRole("button", { name: "勝ったら倍を削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  await expect.element(toggle).not.toBeInTheDocument();
});

test("adds sports-win again for the next day it does not have", async () => {
  onOctober6();
  const screen = await renderSettings(makePlan([], []));
  const add = screen.getByRole("button", { name: "勝ったら倍を追加" });
  await add.click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  await add.click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(2);
  expect((await storedPlan()).benefits.map((benefit) => benefit.conditions.dateRule)).toEqual([
    { type: "dates", dates: ["2026-10-06"] },
    { type: "dates", dates: ["2026-10-07"] },
  ]);
});

test("adds ご愛顧感謝デー once, with the rate of the rank chosen in its row", async () => {
  const screen = await renderSettings({
    ...makePlan([pointDay()], []),
    period: { start: "2026-10-01", end: "2026-10-31" },
  });
  await screen.getByRole("button", { name: "ご愛顧感謝デーを追加" }).click();

  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(2);
  expect((await storedPlan()).benefits[1]).toMatchObject({
    label: "ご愛顧感謝デー",
    enabled: true,
    sharedKey: "thanks-day",
    conditions: { dateRule: { type: "daysOfMonth", days: [18] } },
    params: { rate: 1, cap: 1000 },
  });
  await expect
    .element(screen.getByRole("button", { name: "ご愛顧感謝デー（追加済み）" }))
    .toBeDisabled();
  await expect
    .element(screen.getByRole("button", { name: "ご愛顧感謝デーを編集" }))
    .toHaveAttribute("aria-expanded", "true");

  await screen.getByText("ダイヤモンド会員").click();
  await expect
    .poll(async () => (await storedBenefit("ご愛顧感謝デー"))?.params)
    .toMatchObject({
      rate: 3,
    });
  await expect.element(screen.getByRole("switch", { name: /^ご愛顧感謝デー \+3倍/ })).toBeChecked();

  await screen.getByRole("button", { name: "ご愛顧感謝デーを削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
});

test("adds ワンダフルデー once, on, among the campaigns, and deletes it", async () => {
  const screen = await renderSettings({
    ...makePlan([pointDay()], []),
    period: { start: "2026-10-01", end: "2026-10-31" },
  });
  await screen.getByRole("button", { name: "ワンダフルデーを追加" }).click();

  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(2);
  expect((await storedPlan()).benefits[1]).toMatchObject({
    label: "ワンダフルデー",
    enabled: true,
    sharedKey: "wonderfulday",
    conditions: { dateRule: { type: "daysOfMonth", days: [1] } },
  });
  await expect
    .element(screen.getByRole("button", { name: "ワンダフルデー（追加済み）" }))
    .toBeDisabled();
  await expect.element(screen.getByRole("switch", { name: /^ワンダフルデー \+2倍/ })).toBeChecked();
  await expect.element(screen.getByText("ゴールド会員")).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "ワンダフルデーを削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
});

test("adds 39shop for the plan's period once, and refuses a period it already has", async () => {
  const screen = await renderSettings(makePlan([], []));
  await screen.getByRole("button", { name: "39ショップを追加" }).click();
  await expect
    .element(screen.getByRole("switch", { name: /^39ショップ \+1倍/ }))
    .toHaveAccessibleName(/10\/4〜10\/9$/);
  const added = screen.getByRole("button", { name: "39ショップ（追加済み）" });
  await expect.element(added).toBeDisabled();

  // Another period is a different occurrence, so the template can be added again.
  const start = screen.getByLabelText("開始日");
  await start.fill("2026/10/05");
  await start.element().blur();
  await expect
    .poll(async () => (await storedPlan()).benefits[0]?.sharedKey)
    .toBe("39shop:2026-10-05");
  await screen.getByRole("button", { name: "39ショップを追加" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(2);

  const second = screen.getByLabelText("開始日");
  await second.fill("2026/10/05");
  await second.element().blur();
  await expect
    .element(second)
    .toHaveAccessibleDescription("この期間の39ショップはもう追加してあります");
  expect((await storedPlan()).benefits[1]?.sharedKey).toBe("39shop:2026-10-04");
});

test("adds a repeat purchase with a cap to start from, and says what to fix", async () => {
  const screen = await renderSettings(makePlan([], []));
  await screen.getByRole("button", { name: "リピート購入を追加" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  expect((await storedPlan()).benefits[0]).toMatchObject({
    params: { cap: 1000 },
    conditions: { minOrderAmount: 3980 },
  });

  const end = screen.getByLabelText("終了日");
  await end.fill("2026/10/01");
  await end.element().blur();
  await expect
    .element(end)
    .toHaveAccessibleDescription("終了日は開始日と同じ日か、それより後の日にしてください");
  // The start date stays level with the end date and its error.
  expect(misalignedFields(screen.getByRole("region", { name: "キャンペーン" }).element())).toEqual(
    [],
  );

  const cap = screen.getByLabelText("獲得上限（P）");
  await cap.fill("たくさん");
  await cap.element().blur();
  await expect.element(cap).toHaveAccessibleDescription("獲得上限は0以上の整数で入れてください");
  await cap.fill("２，０００Ｐ");
  await cap.element().blur();
  await expect.poll(async () => (await storedPlan()).benefits[0]?.params.cap).toBe(2000);
  expect((await storedPlan()).benefits[0]?.conditions.dateRule).toEqual({
    type: "range",
    start: "2026-10-04",
    end: "2026-10-09",
  });
});

test("a cap that is not a number is not saved, and says what to type", async () => {
  const screen = await renderSettings(makePlan(structuredClone(marathon), [order(0)]));
  await screen.getByRole("button", { name: /ショップ買いまわり/ }).click();
  const cap = screen.getByLabelText("獲得上限");
  await cap.fill("たくさん");
  await cap.element().blur();

  await expect.element(cap).toHaveAccessibleDescription("獲得上限は0以上の整数で入れてください");
  expect((await storedPlan()).benefits[0]?.params.cap).toBe(7000);
  // The error follows each input once it is shown.
  await cap.fill("５，０００Ｐ");
  await expect.element(cap).not.toHaveAttribute("aria-invalid");
  await cap.element().blur();
  await expect.poll(async () => (await storedPlan()).benefits[0]?.params.cap).toBe(5000);
});

test("a period's end before its start is not saved", async () => {
  const screen = await renderSettings(makePlan(structuredClone(marathon), [order(0)]));
  await screen.getByRole("button", { name: /ショップ買いまわり/ }).click();
  const end = screen.getByLabelText("終了日");
  await end.fill("2026/10/01");
  await end.element().blur();
  await expect
    .element(end)
    .toHaveAccessibleDescription("終了日は開始日と同じ日か、それより後の日にしてください");
  // The start date stays level with the end date and its error.
  expect(
    misalignedFields(screen.getByRole("region", { name: "買いまわりと上限" }).element()),
  ).toEqual([]);
  const start = screen.getByLabelText("開始日");
  await start.fill("2026/10/10");
  await start.element().blur();
  await expect
    .element(start)
    .toHaveAccessibleDescription("開始日は終了日と同じ日か、それより前の日にしてください");
  expect((await storedPlan()).benefits[0]?.conditions.dateRule).toEqual({
    type: "range",
    start: "2026-10-04",
    end: "2026-10-09",
  });
});

test("overrides the shop-around cap", async () => {
  const screen = await renderSettings(makePlan(structuredClone(marathon), [order(0)]));
  const row = screen.getByRole("button", { name: /ショップ買いまわり/ });
  await expect.element(row).toHaveAttribute("aria-expanded", "false");
  await expect.element(row.getByText("10/4〜10/9・最大 +9倍・上限 7,000P")).toBeVisible();

  await row.click();
  await expect.element(row).toHaveAttribute("aria-expanded", "true");
  const cap = screen.getByLabelText("獲得上限");
  await expect.element(cap).toHaveValue("7,000");
  await cap.fill("5,000");
  await cap.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await expect.poll(async () => (await storedPlan()).benefits[0]?.params.cap).toBe(5000);
  await expect.element(row.getByText("10/4〜10/9・最大 +9倍・上限 5,000P")).toBeVisible();

  const end = screen.getByLabelText("終了日");
  await end.fill("2026/10/10");
  await end.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await expect
    .poll(async () => (await storedPlan()).benefits[0]?.conditions.dateRule)
    .toEqual({ type: "range", start: "2026-10-04", end: "2026-10-10" });
  // The plan's own period stays as it was.
  expect((await storedPlan()).period).toEqual({ start: "2026-10-04", end: "2026-10-09" });
});

test("adds a two-shop beside the plan's shop-around, as a campaign of its own", async () => {
  const screen = await renderSettings(makePlan(structuredClone(marathon), [order(0)]));
  await expect
    .element(screen.getByRole("button", { name: "買いまわり（手動）（追加済み）" }))
    .toBeDisabled();
  await screen.getByRole("button", { name: "2ショップ購入を追加" }).click();
  await expect
    .element(screen.getByRole("switch", { name: /^2ショップ購入 \+2倍/ }))
    .toHaveAccessibleName(/10\/4〜10\/9$/);
  await expect.element(screen.getByRole("button", { name: /ショップ買いまわり/ })).toBeVisible();
  await expect
    .poll(async () => (await storedBenefit("2ショップ購入"))?.sharedKey)
    .toBe("2shop:2026-10-04");
  await expect
    .poll(async () => await storedBenefit("2ショップ購入"))
    .toMatchObject({ campaignType: "two-shop" });
});

test("adds a campaign of tiers by the total, and changes its tiers and cap", async () => {
  const screen = await renderSettings(makePlan([], [order(0)]));
  await screen.getByRole("button", { name: "合計額で倍率（手動）を追加" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);

  const card = screen.getByRole("region", { name: "合計額で倍率" });
  const row = card.getByRole("button", { name: /合計額で倍率/ });
  await expect.element(row.getByText("10/4〜10/9・最大 +1倍・上限 1,000P")).toBeVisible();
  await row.click();
  // The order of ¥11,000 reaches the only tier, from ¥5,000.
  await expect.element(card.getByText("いまの合計 ¥11,000（税込）で +1倍。")).toBeVisible();

  await card.getByRole("button", { name: "段階を足す" }).click();
  await expect
    .poll(async () => (await storedBenefit("合計額で倍率"))?.params)
    .toMatchObject({
      tiers: [
        { minAmount: 5000, rate: 1 },
        { minAmount: 10000, rate: 2 },
      ],
    });
  await expect.element(card.getByText("いまの合計 ¥11,000（税込）で +2倍。")).toBeVisible();

  const second = card.getByLabelText("2段目の合計額（円以上）");
  await second.fill("5,000");
  await second.element().blur();
  await expect.element(second).toHaveAccessibleDescription("同じ合計額の段階がもうあります");
  await second.fill("２０，０００");
  enter(second.element());
  await expect
    .poll(async () => (await storedBenefit("合計額で倍率"))?.params)
    .toMatchObject({
      tiers: [
        { minAmount: 5000, rate: 1 },
        { minAmount: 20000, rate: 2 },
      ],
    });
  await expect
    .element(card.getByText("いまの合計 ¥11,000（税込）で +1倍。あと ¥9,000 で +2倍。"))
    .toBeVisible();

  const rate = card.getByLabelText("2段目の倍率（+N倍）");
  await rate.fill("3");
  enter(rate.element());
  await expect.element(row.getByText("10/4〜10/9・最大 +3倍・上限 1,000P")).toBeVisible();

  const cap = card.getByLabelText("獲得上限（P）");
  await cap.fill("5,000");
  enter(cap.element());
  await expect.element(row.getByText("10/4〜10/9・最大 +3倍・上限 5,000P")).toBeVisible();

  await card.getByRole("button", { name: "1段目を削除" }).click();
  await expect
    .poll(async () => (await storedBenefit("合計額で倍率"))?.params)
    .toMatchObject({ tiers: [{ minAmount: 20000, rate: 3 }] });
  // The last tier stays.
  await expect.element(card.getByRole("button", { name: "1段目を削除" })).not.toBeInTheDocument();
});

/** Types into a field without moving the focus, so nothing is committed on blur. */
function typeInto(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
const enter = (element: Element) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

test("start and end dates committed back to back both persist", async () => {
  const screen = await renderSettings(makePlan(structuredClone(marathon), [order(0)]));
  await screen.getByRole("button", { name: /ショップ買いまわり/ }).click();
  const start = screen.getByLabelText("開始日").element() as HTMLInputElement;
  const end = screen.getByLabelText("終了日").element() as HTMLInputElement;
  typeInto(start, "2026/10/03");
  typeInto(end, "2026/10/10");
  await expect.element(screen.getByLabelText("終了日")).toHaveValue("2026/10/10");
  // Both commits come from the same render, before either save has updated the plan.
  enter(start);
  enter(end);
  await expect
    .poll(async () => (await storedPlan()).benefits[0]?.conditions.dateRule)
    .toEqual({ type: "range", start: "2026-10-03", end: "2026-10-10" });
  await expect.element(screen.getByText("10/3〜10/10・最大 +9倍・上限 7,000P")).toBeVisible();
});

test("a failed save is reported and cleared when the settings are opened again", async () => {
  const screen = await renderSettings(spuPlan([pointDay()]));
  const update = repository().plans.update.bind(repository().plans);
  repository().plans.update = () => Promise.reject(new Error("quota"));
  await tapCard(
    screen
      .getByRole("region", { name: "キャンペーン" })
      .getByRole("switch", { name: "5と0のつく日 +1倍 毎月5・10・15・20・25・30日" }),
  );
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();

  repository().plans.update = update;
  await screen.getByRole("link", { name: "計算に戻る" }).click();
  await expect.element(screen.getByRole("heading", { name: "プランのホーム" })).toBeVisible();
  await screen.router.navigate({ to: "/plan/settings", search: { id: PLAN } });
  await expect.element(screen.getByRole("heading", { name: "プランの設定" })).toBeVisible();
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .not.toBeInTheDocument();
});

test("save button goes back to the plan home", async () => {
  const screen = await renderSettings(spuPlan());
  await screen.getByRole("link", { name: "計算に戻る" }).click();
  await expect.element(screen.getByRole("heading", { name: "プランのホーム" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ id: PLAN });
});

test("on a desktop the settings open in a side panel, and 変更 opens the month's SPU in its place, which goes back to them", async () => {
  await page.viewport(1280, 900);
  const plan = makePlan(structuredClone(marathon), [order(0)]);
  currentRepository = createMemoryRepository({
    shops,
    plans: [plan],
    spuMonths: [spuMonth(["楽天モバイル"])],
  });
  const screen = await renderPlanHome(currentRepository);
  await screen.getByRole("button", { name: "プランの設定" }).click();

  const panel = screen.getByRole("dialog", { name: "プランの設定" });
  await expect
    .element(panel.getByRole("region", { name: "SPU" }))
    .toMatchTextContent("SPU（10月）5倍");
  await panel.getByRole("button", { name: "10月の SPU を変更" }).click();
  await expect.element(panel).not.toBeInTheDocument();

  const spu = screen.getByRole("dialog", { name: "10月の SPU" });
  await tapCard(spu.getByRole("checkbox", { name: "楽天ブックス +0.5倍" }));
  await expect.poll(() => storedOn("楽天ブックス")).toBe(true);
  await spu.getByRole("button", { name: "プランの設定に戻る" }).last().click();
  await expect.element(spu).not.toBeInTheDocument();
  await expect.element(screen.getByRole("dialog", { name: "プランの設定" })).toBeVisible();
});
test("the account is picked only once accounts are told apart", async () => {
  const SUB = "acc00000-0000-4000-8000-000000000002";
  const profile: Profile = {
    accounts: [defaultAccount(), { id: SUB, name: "家族" }],
    updatedAt: "2026-10-05T00:00:00.000Z",
  };
  const off = await renderSettings(spuPlan(), profile);
  await expect.element(spuSection(off)).toBeVisible();
  expect(off.getByRole("combobox", { name: "購入するアカウント" }).query()).toBeNull();
  expect(off.getByRole("region", { name: "アカウント" }).query()).toBeNull();

  const screen = await renderSettings(spuPlan(), { ...profile, multiAccount: true });
  const picker = screen.getByRole("combobox", { name: "購入するアカウント" });
  await expect.element(picker).toHaveValue(defaultAccount().id);
  await picker.selectOptions("家族");
  await expect.element(picker).toHaveValue(SUB);
  await expect.poll(async () => (await storedPlan()).accountId).toBe(SUB);

  await picker.selectOptions("メイン");
  await expect.poll(async () => (await storedPlan()).accountId).toBeUndefined();
});

test("the SPU is the month's: the settings show each month's rate, and 変更 opens the month's page from the plan's settings", async () => {
  const plan = spuPlan([], [order(0), { ...order(1), date: "2026-11-02" }]);
  const screen = await renderSettings(plan, undefined, [spuMonth(["楽天モバイル"])]);
  const section = spuSection(screen);
  await expect.element(section).toMatchTextContent("月ごとに、すべてのプランで共有");
  // The order outside the period brings November in; November takes October's contract.
  await expect
    .element(section.getByRole("group", { name: "10月の SPU" }))
    .toMatchTextContent("5倍注文 1件");
  await expect
    .element(section.getByRole("group", { name: "11月の SPU" }))
    .toMatchTextContent("5倍注文 1件未設定・10月から引き継ぎ");

  await section.getByRole("button", { name: "11月の SPU を変更" }).click();
  await expect.element(screen.getByRole("heading", { name: "月の SPU" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ month: "2026-11" });
  expect(screen.router.state.location.state.spuFrom).toEqual({ planId: PLAN, settings: true });
});

test("attaches a plan made without an event to an event, after saying what it replaces", async () => {
  const event: OfficialEvent = {
    id: "marathon-2026-10",
    name: "お買い物マラソン",
    period: { start: "2026-10-04", end: "2026-10-09" },
    benefits: structuredClone(marathon),
  };
  const made = createPlan({
    id: PLAN,
    name: "自分の計画",
    now: "2026-10-01T00:00:00.000Z",
    newId: () => crypto.randomUUID(),
  });
  const [fixed, ...restFixed] = made.benefits;
  if (!fixed) throw new Error("no fixed campaigns");
  const outside = { ...order(1), date: "2026-10-15" };
  const own: Plan = {
    ...made,
    period: { start: "2026-10-01", end: "2026-10-20" },
    benefits: [{ ...fixed, enabled: true }, ...restFixed],
    orders: [order(0), outside],
  };
  const screen = await renderSettings(own, undefined, [], [event]);

  const section = screen.getByRole("region", { name: "公式イベント" });
  const attach = section.getByRole("button", { name: "結びつける" });
  await expect.element(attach).toBeDisabled();
  const picker = section.getByRole("combobox", { name: "公式イベントに結びつける" });
  await picker.selectOptions("お買い物マラソン（10/4〜10/9）");
  await expect.element(picker).toHaveValue(event.id);
  await attach.click();

  const dialog = screen.getByRole("dialog", { name: "公式イベントに結びつけますか？" });
  await expect
    .element(dialog.getByText("期間を「お買い物マラソン」の 10/4〜10/9 にします。"))
    .toBeVisible();
  await expect.element(dialog.getByText(/期間の外になる注文が 1 件あります/)).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  expect((await storedPlan()).officialEventId).toBeUndefined();

  await attach.click();
  await screen.getByRole("dialog").getByRole("button", { name: "結びつける" }).click();
  await expect.poll(async () => (await storedPlan()).officialEventId).toBe(event.id);
  const stored = await storedPlan();
  expect(stored.period).toEqual(event.period);
  expect(stored.benefits).toEqual([
    ...event.benefits,
    expect.objectContaining({ sharedKey: "rakuma:marathon-2026-10", enabled: false }),
    { ...fixed, enabled: true },
    ...restFixed,
  ]);
  expect(stored.orders).toEqual(own.orders);
  // Now a plan of the event, it is offered to be carried over, not attached.
  await expect
    .element(section.getByRole("combobox", { name: "公式イベントに結びつける" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /お買い物マラソン/ })).toBeVisible();
});

const octoberEvent: OfficialEvent = {
  id: "marathon-2026-10",
  name: "お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: structuredClone(marathon),
};

/** Today is 11/27, after October's event. */
const onNovember27 = () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
};

test("carries a held plan of an ended event over to an event that has not ended, and releases its hold", async () => {
  onNovember27();
  const ended: OfficialEvent = {
    ...octoberEvent,
    id: "marathon-2026-11-04",
    name: "11月のマラソン",
    period: { start: "2026-11-04", end: "2026-11-11" },
  };
  const next: OfficialEvent = {
    ...octoberEvent,
    id: "marathon-2026-12-04",
    name: "12月のマラソン",
    period: { start: "2026-12-04", end: "2026-12-11" },
  };
  const held: Plan = {
    ...makePlan(structuredClone(marathon), [order(0)]),
    officialEventId: octoberEvent.id,
    onHold: true,
  };
  const screen = await renderSettings(held, undefined, [], [octoberEvent, ended, next]);

  const section = screen.getByRole("region", { name: "公式イベント" });
  const picker = section.getByRole("combobox", { name: "別のイベントに引き継ぐ" });
  // Neither the plan's own event nor one that has ended is offered.
  await expect.element(picker).toMatchTextContent("イベントを選ぶ12月のマラソン（12/4〜12/11）");
  await picker.selectOptions("12月のマラソン（12/4〜12/11）");
  await section.getByRole("button", { name: "引き継ぐ" }).click();

  const dialog = screen.getByRole("dialog", { name: "別のイベントに引き継ぎますか？" });
  await expect
    .element(dialog.getByText("プランの保留を解き、ほかのプランと合わせて計算します。"))
    .toBeVisible();
  await dialog.getByRole("button", { name: "引き継ぐ" }).click();
  await expect.poll(async () => (await storedPlan()).officialEventId).toBe(next.id);
  const stored = await storedPlan();
  expect(stored.period).toEqual(next.period);
  expect(stored).not.toHaveProperty("onHold");
  expect(stored.orders).toEqual(held.orders);
});

test("a plan of an event with no event to carry it over to says that one can be chosen once published", async () => {
  onNovember27();
  const screen = await renderSettings(
    { ...makePlan(structuredClone(marathon), []), officialEventId: octoberEvent.id, onHold: true },
    undefined,
    [],
    [octoberEvent],
  );
  const section = screen.getByRole("region", { name: "公式イベント" });
  await expect
    .element(section)
    .toMatchTextContent(
      "別のイベントに引き継ぐ引き継げるイベントはまだありません。次のイベントが公開されたら、ここで選べます。",
    );
  await expect.element(section.getByRole("combobox")).not.toBeInTheDocument();
});

test("the hold switch holds the plan and releases it", async () => {
  const screen = await renderSettings(makePlan([], [order(0)]));
  const hold = screen.getByRole("switch", { name: "このプランを保留にする" });

  await tapCard(hold);
  await vi.waitFor(async () => expect((await storedPlan()).onHold).toBe(true));

  await tapCard(hold);
  await vi.waitFor(async () => expect(await storedPlan()).not.toHaveProperty("onHold"));
});

test("holding the only Books order from the settings page tells that the month's Books SPU may be lost", async () => {
  const withBooks = shops.map((shop, index) =>
    index === 0 ? { ...shop, channel: "rakuten-books" as const } : shop,
  );
  const screen = await renderSettings(
    makePlan([], [order(0)]),
    undefined,
    [spuMonth(["楽天ブックス"])],
    undefined,
    withBooks,
  );

  await tapCard(screen.getByRole("switch", { name: "このプランを保留にする" }));

  await expect
    .element(page.getByText("10月の SPU の楽天ブックスの対象外になるかもしれません"))
    .toBeVisible();
});

test("開催日がない固定キャンペーンの追加ボタンには理由を出す", async () => {
  const screen = await renderSettings({
    ...makePlan([], []),
    period: { start: "2026-10-20", end: "2026-10-21" },
  });
  for (const name of ["ご愛顧感謝デー", "ワンダフルデー"]) {
    await expect
      .element(screen.getByRole("button", { name: `${name}（この期間に開催日がありません）` }))
      .toBeDisabled();
  }
  expect((await storedPlan()).benefits).toEqual([]);
});
