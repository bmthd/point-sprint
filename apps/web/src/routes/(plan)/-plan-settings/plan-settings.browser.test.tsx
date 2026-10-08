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
  type Plan,
  type Profile,
  campaignTemplates,
  defaultAccount,
  standardSpu,
} from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "../../../storage/memory-repository";
import { misalignedFields } from "../../../test-layout";
import {
  PLAN,
  Providers,
  makePlan,
  marathon,
  order,
  renderPlanHome,
  shops,
} from "../-test-fixtures";
import { PlanSettings } from "./plan-settings";

beforeEach(async () => {
  await page.viewport(390, 844);
});

/**
 * Taps a checkbox card (an SPU tile, a campaign). Its checkbox is visually hidden under the card, so
 * the card (its label) is tapped.
 */
const tapCard = (tile: Locator) => {
  const label = tile.element().closest("label");
  if (!label) throw new Error("no card label");
  return page.elementLocator(label).click();
};

const spuByLabel = (label: string): Benefit => {
  const benefit = standardSpu.find((candidate) => candidate.label === label);
  if (!benefit) throw new Error(`no SPU ${label}`);
  return structuredClone(benefit);
};

const enabled = (benefit: Benefit): Benefit => ({ ...benefit, enabled: true });

/** The standard SPU as a new profile has it: only 通常ポイント is on. */
const spuPlan = (benefits: Benefit[] = structuredClone(standardSpu), orders = [order(0)]) =>
  makePlan(benefits, orders);

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

async function renderSettings(plan: Plan, profile?: Profile) {
  currentRepository = createMemoryRepository({ shops, plans: [plan], profile });
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
  const router = createRouter({
    routeTree: root.addChildren([home, settings]),
    history: createMemoryHistory({ initialEntries: [`/plan/settings?id=${PLAN}`] }),
  });
  const screen = await render(
    <Providers repository={currentRepository}>
      <RouterProvider router={router} />
    </Providers>,
  );
  await expect.element(screen.getByRole("heading", { name: "プランの設定" })).toBeVisible();
  return Object.assign(screen, { router });
}

type Screen = Awaited<ReturnType<typeof renderSettings>>;

const spuSection = (screen: Screen) => screen.getByRole("region", { name: "SPU" });
const spuText = (screen: Screen) => spuSection(screen).element().textContent ?? "";

test("tile toggles SPU and updates the total", async () => {
  const screen = await renderSettings(spuPlan());
  const mobile = screen.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  await expect
    .element(spuSection(screen).getByRole("img", { name: "楽天モバイル", exact: true }))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/spu/service_mobile_v2.webp");
  await expect.element(mobile).not.toBeChecked();
  expect(spuText(screen)).toContain("SPU を入れて全商品1倍");
  // 通常ポイント is not a tile; 楽天カード通常分 is, under a short name.
  expect(screen.getByRole("checkbox", { name: /^通常ポイント/ }).query()).toBeNull();
  await expect
    .element(screen.getByRole("checkbox", { name: "楽天カード（通常） +1倍" }))
    .not.toBeChecked();

  await tapCard(mobile);
  await expect.element(mobile).toBeChecked();
  await expect.poll(() => spuText(screen)).toContain("SPU を入れて全商品5倍");
  expect(spuText(screen)).toContain("SPU +4倍");
  await expect.poll(async () => (await storedBenefit("楽天モバイル"))?.enabled).toBe(true);

  // The card's own normal points count as 通常, not as SPU. Turning them on also turns on the
  // card's SPU bonus, which requires them.
  await tapCard(screen.getByRole("checkbox", { name: "楽天カード（通常） +1倍" }));
  await expect.poll(() => spuText(screen)).toContain("SPU を入れて全商品7倍");
  expect(spuText(screen)).toContain("通常 2倍");
  expect(spuText(screen)).toContain("SPU +5倍");
  await expect
    .element(screen.getByRole("checkbox", { name: "楽天カード特典分（SPU） +1倍" }))
    .toBeChecked();

  await tapCard(mobile);
  await expect.element(mobile).not.toBeChecked();
  await expect.poll(async () => (await storedBenefit("楽天モバイル"))?.enabled).toBe(false);

  // A tile is a checkbox, so Space toggles the focused tile.
  (mobile.element() as HTMLElement).focus();
  await userEvent.keyboard(" ");
  await expect.element(mobile).toBeChecked();
  await expect.poll(async () => (await storedBenefit("楽天モバイル"))?.enabled).toBe(true);
});

test("campaigns show the image from their master data", async () => {
  const pointDay = structuredClone(
    campaignTemplates.find((template) => template.id === "pointday")?.benefit,
  );
  if (!pointDay) throw new Error("no pointday campaign");
  const screen = await renderSettings(makePlan([pointDay], []));

  await expect
    .element(screen.getByRole("img", { name: "5と0のつく日" }))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/campaign/pointday.webp");
  expect(
    getComputedStyle(screen.getByRole("img", { name: "5と0のつく日" }).element()).borderRadius,
  ).toBe("0px");

  await screen.getByRole("button", { name: "＋ 追加" }).click();
  await expect
    .element(screen.getByRole("img", { name: "勝ったら倍" }))
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/campaign/sports.webp");
});

test("enabling premium card turns off the regular card", async () => {
  const benefits = structuredClone(standardSpu).map((benefit) =>
    benefit.label === "楽天カード特典分（SPU）" ? enabled(benefit) : benefit,
  );
  const screen = await renderSettings(spuPlan(benefits));
  const card = screen.getByRole("checkbox", { name: "楽天カード特典分（SPU） +1倍" });
  const premium = screen.getByRole("checkbox", { name: "楽天プレミアムカード（特典分） +1倍" });
  await expect.element(card).toBeChecked();

  await tapCard(premium);
  await expect.element(premium).toBeChecked();
  await expect.element(card).not.toBeChecked();
  await expect
    .poll(async () => [
      (await storedBenefit("楽天カード特典分（SPU）"))?.enabled,
      (await storedBenefit("楽天プレミアムカード（特典分）"))?.enabled,
    ])
    .toEqual([false, true]);

  await tapCard(card);
  await expect.element(card).toBeChecked();
  await expect.element(premium).not.toBeChecked();
});

test("the premium card turns the card's normal points on and off with it", async () => {
  const screen = await renderSettings(spuPlan());
  const normal = screen.getByRole("checkbox", { name: "楽天カード（通常） +1倍" });
  const premium = screen.getByRole("checkbox", { name: "楽天プレミアムカード（特典分） +1倍" });
  await expect.element(normal).not.toBeChecked();

  await tapCard(premium);
  await expect.element(premium).toBeChecked();
  await expect.element(normal).toBeChecked();
  await expect
    .poll(async () => (await storedBenefit("楽天カード通常分（カード本体の還元）"))?.enabled)
    .toBe(true);

  await tapCard(premium);
  await expect.element(premium).not.toBeChecked();
  await expect.element(normal).not.toBeChecked();
  await expect
    .poll(async () => (await storedBenefit("楽天カード通常分（カード本体の還元）"))?.enabled)
    .toBe(false);
});

test("cap badge appears when the cap is reached", async () => {
  // ¥10,000 before tax per order: +0.5倍 gives 50P per order, so two orders reach the 100P cap.
  const books = enabled(spuByLabel("楽天ブックス"));
  books.params.cap = 100;
  const kobo = enabled(spuByLabel("楽天Kobo"));
  const screen = await renderSettings(spuPlan([books, kobo], [order(0), order(1), order(2)]));

  const booksTile = screen.getByRole("checkbox", { name: "楽天ブックス +0.5倍" });
  // The badge sits on the tile and describes its checkbox; only the capped tile has one.
  await expect.element(booksTile).toHaveAccessibleDescription("上限");
  const badges = screen
    .getByRole("group", { name: "SPU のサービス" })
    .getByText("上限", { exact: true });
  await expect.element(badges).toBeVisible();
  expect(badges.elements()).toHaveLength(1);
  await expect
    .element(screen.getByRole("checkbox", { name: "楽天Kobo +0.5倍" }))
    .not.toHaveAccessibleDescription();

  // The name opens the cap and the conditions.
  await screen.getByRole("button", { name: "楽天ブックスの上限と条件" }).click();
  const detail = screen.getByRole("dialog", { name: "楽天ブックス" });
  await expect.element(detail.getByText("月間上限 100P")).toBeVisible();
  await expect.element(detail.getByText("このプランで上限に達しています")).toBeVisible();
  await expect
    .element(detail.getByRole("link", { name: /楽天で自分のSPUを確認する/ }))
    .toHaveAttribute("href", "https://event.rakuten.co.jp/campaign/point-up/everyday/point/");
});

test("adds a sports-win day from the template", async () => {
  const screen = await renderSettings(makePlan([], []));
  const add = screen.getByRole("button", { name: "＋ 追加" });
  await expect.element(add).toHaveAttribute("aria-expanded", "false");
  await add.click();
  await expect.element(add).toHaveAttribute("aria-expanded", "true");

  await screen.getByRole("button", { name: /^勝ったら倍/ }).click();
  const dialog = screen.getByRole("dialog", { name: "勝ったら倍を追加" });
  const date = dialog.getByLabelText("日付");
  // Opening the dialog neither focuses the date nor opens its calendar.
  await expect.element(date).toBeVisible();
  await expect.element(date).not.toHaveFocus();
  await expect.element(screen.getByRole("grid")).not.toBeInTheDocument();
  // The dialog shows the campaign's image, which follows the chosen rate.
  const thumbnail = () => dialog.element().querySelector("header img");
  expect(thumbnail()).toHaveAttribute(
    "src",
    "https://assets.bmth.dev/point-sprint/img/campaign/sports.webp",
  );

  // Tapping the date opens the calendar, not the on-screen keyboard, and a day picked there fills
  // it in.
  await expect.element(date).toHaveAttribute("inputmode", "none");
  await date.click();
  const calendar = screen.getByRole("grid");
  await calendar.getByText("6", { exact: true }).click();
  await expect.element(date).toHaveValue("2026/10/06");
  await expect.element(calendar).not.toBeInTheDocument();
  const rate = dialog.getByRole("radiogroup", { name: "倍率" });
  const double = rate.getByRole("radio", { name: /^\+2倍/ });
  await expect.element(rate.getByRole("radio", { name: /^\+1倍/ })).toBeChecked();
  // The radio is visually hidden under its card, so the card's text is tapped.
  await rate.getByText("両方のチームが勝った日").click();
  await expect.element(double).toBeChecked();
  await expect
    .poll(thumbnail)
    .toHaveAttribute("src", "https://assets.bmth.dev/point-sprint/img/campaign/sports-w.webp");
  await dialog.getByRole("button", { name: "追加する" }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  expect((await storedPlan()).benefits[0]).toMatchObject({
    label: "勝ったら倍",
    category: "campaign",
    enabled: true,
    conditions: { dateRule: { type: "dates", dates: ["2026-10-06"] } },
    params: { rate: 2 },
  });
  const toggle = screen.getByRole("checkbox", { name: "勝ったら倍 +2倍 10/6" });
  await expect.element(toggle).toBeChecked();

  await tapCard(toggle);
  await expect.element(toggle).not.toBeChecked();
  await expect.poll(async () => (await storedPlan()).benefits[0]?.enabled).toBe(false);

  // An added campaign can be deleted after a confirmation.
  await screen.getByRole("button", { name: "勝ったら倍を削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(0);
  await expect.element(toggle).not.toBeInTheDocument();
});

test("prevents adding the same 39shop period twice", async () => {
  const screen = await renderSettings(makePlan([], []));
  const add39 = async () => {
    const add = screen.getByRole("button", { name: "＋ 追加" });
    if (add.element().getAttribute("aria-expanded") === "false") await add.click();
    await screen
      .getByRole("list", { name: "追加できるキャンペーン" })
      .getByRole("button", { name: /^39ショップ/ })
      .click();
    return screen.getByRole("dialog", { name: "39ショップを追加" });
  };

  const first = await add39();
  await expect.element(first.getByLabelText("開始日")).toHaveValue("2026/10/04");
  await expect.element(first.getByLabelText("終了日")).toHaveValue("2026/10/09");
  await first.getByRole("button", { name: "追加する" }).click();
  await expect.element(first).not.toBeInTheDocument();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  await expect
    .element(screen.getByRole("checkbox", { name: /^39ショップ \+1倍/ }))
    .toHaveAccessibleName(/10\/4〜10\/9$/);

  const second = await add39();
  await expect
    .element(second.getByText("この期間の39ショップはもう追加してあります"))
    .toBeVisible();
  await expect.element(second.getByRole("button", { name: "追加する" })).toBeDisabled();

  // Another period is a different occurrence.
  await second.getByLabelText("開始日").fill("2026-10-05");
  await expect.element(second.getByRole("button", { name: "追加する" })).toBeEnabled();
  await second.getByRole("button", { name: "キャンセル" }).click();
  expect((await storedPlan()).benefits).toHaveLength(1);
});

test("a campaign's form says what to fix, and focuses the first field to fix", async () => {
  const screen = await renderSettings(makePlan([], []));
  await screen.getByRole("button", { name: "＋ 追加" }).click();
  await screen.getByRole("button", { name: /^リピート購入/ }).click();
  const dialog = screen.getByRole("dialog", { name: "リピート購入を追加" });
  const end = dialog.getByLabelText("終了日");
  const cap = dialog.getByLabelText("獲得上限（P）");
  await end.fill("2026-10-01");
  await dialog.getByLabelText("条件金額（円）").fill("３，９８０円");
  await dialog.getByRole("button", { name: "追加する" }).click();

  await expect
    .element(end)
    .toHaveAccessibleDescription("終了日は開始日と同じ日か、それより後の日にしてください");
  await expect.element(cap).toHaveAccessibleDescription("獲得上限を入れてください");
  await expect.element(end).toHaveFocus();
  // The start date stays level with the end date and its error.
  expect(misalignedFields(dialog.element())).toEqual([]);
  expect((await storedPlan()).benefits).toHaveLength(0);

  await end.fill("2026-10-09");
  await cap.fill("1,000P");
  await dialog.getByRole("button", { name: "追加する" }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.poll(async () => (await storedPlan()).benefits).toHaveLength(1);
  expect((await storedPlan()).benefits[0]).toMatchObject({
    params: { cap: 1000 },
    conditions: { minOrderAmount: 3980 },
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
  await end.fill("2026-10-01");
  await end.element().blur();
  await expect
    .element(end)
    .toHaveAccessibleDescription("終了日は開始日と同じ日か、それより後の日にしてください");
  // The start date stays level with the end date and its error.
  expect(
    misalignedFields(screen.getByRole("region", { name: "買いまわりと上限" }).element()),
  ).toEqual([]);
  const start = screen.getByLabelText("開始日");
  await start.fill("2026-10-10");
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
  await end.fill("2026-10-10");
  await end.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await expect
    .poll(async () => (await storedPlan()).benefits[0]?.conditions.dateRule)
    .toEqual({ type: "range", start: "2026-10-04", end: "2026-10-10" });
  // The plan's own period stays as it was.
  expect((await storedPlan()).period).toEqual({ start: "2026-10-04", end: "2026-10-09" });
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
  typeInto(start, "2026-10-03");
  typeInto(end, "2026-10-10");
  await expect.element(screen.getByLabelText("終了日")).toHaveValue("2026-10-10");
  // Both commits come from the same render, before either save has updated the plan.
  enter(start);
  enter(end);
  await expect
    .poll(async () => (await storedPlan()).benefits[0]?.conditions.dateRule)
    .toEqual({ type: "range", start: "2026-10-03", end: "2026-10-10" });
  await expect.element(screen.getByText("10/3〜10/10・最大 +9倍・上限 7,000P")).toBeVisible();
});

test("a failed save is reported and cleared when the settings are opened again", async () => {
  const screen = await renderSettings(spuPlan());
  const put = repository().plans.put.bind(repository().plans);
  repository().plans.put = () => Promise.reject(new Error("quota"));
  await tapCard(screen.getByRole("checkbox", { name: "楽天モバイル +4倍" }));
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();

  repository().plans.put = put;
  await screen.getByRole("link", { name: "保存して計算に反映" }).click();
  await expect.element(screen.getByRole("heading", { name: "プランのホーム" })).toBeVisible();
  await screen.router.navigate({ to: "/plan/settings", search: { id: PLAN } });
  await expect.element(screen.getByRole("heading", { name: "プランの設定" })).toBeVisible();
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .not.toBeInTheDocument();
});

test("save button goes back to the plan home", async () => {
  const screen = await renderSettings(spuPlan());
  await screen.getByRole("link", { name: "保存して計算に反映" }).click();
  await expect.element(screen.getByRole("heading", { name: "プランのホーム" })).toBeVisible();
  expect(screen.router.state.location.search).toEqual({ id: PLAN });
});

test("on a desktop the header button opens the settings in a side panel", async () => {
  await page.viewport(1280, 900);
  const plan = makePlan(
    [
      ...structuredClone(standardSpu).map((benefit) =>
        benefit.label === "楽天モバイル" ? enabled(benefit) : benefit,
      ),
      ...structuredClone(marathon),
    ],
    [order(0)],
  );
  currentRepository = createMemoryRepository({ shops, plans: [plan] });
  const screen = await renderPlanHome(currentRepository);
  const open = screen.getByRole("button", { name: "プランの設定（SPU +4倍・上限 7,000P）" });
  await expect.element(open).toBeVisible();
  await open.click();

  const panel = screen.getByRole("dialog", { name: "プランの設定" });
  await tapCard(panel.getByRole("checkbox", { name: "楽天ブックス +0.5倍" }));
  await expect
    .element(screen.getByRole("button", { name: "プランの設定（SPU +4.5倍・上限 7,000P）" }))
    .toBeInTheDocument();
  await panel.getByRole("button", { name: "保存して計算に反映" }).click();
  await expect.element(panel).not.toBeInTheDocument();
});

test("the account is picked only once accounts are told apart", async () => {
  const SUB = "acc00000-0000-4000-8000-000000000002";
  const profile: Profile = {
    spuBenefits: [],
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
