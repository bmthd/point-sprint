import type { Benefit, Plan, Shop } from "@workspaces/domain";
import { beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMemoryRepository } from "../../storage/memory-repository";
import { tokyoToday } from "../plan-list/dates";
import {
  PLAN,
  baseBenefit,
  makePlan,
  marathon,
  marathonPlan,
  order,
  orderId,
  renderPlanHome,
  shopId,
  shops,
  spuBenefit,
} from "../plan-home/test-fixtures";

beforeEach(async () => {
  await page.viewport(390, 844);
});

let currentRepository: ReturnType<typeof createMemoryRepository> | undefined;
const repository = () => {
  if (!currentRepository) throw new Error("no repository");
  return currentRepository;
};
const stored = async () => (await repository().plans.get(PLAN))?.orders ?? [];
const storedShop = async (id: string) => (await repository().shops.list()).find((s) => s.id === id);

async function renderWith(plan: Plan = marathonPlan(), withShops: Shop[] = shops) {
  currentRepository = createMemoryRepository({ shops: withShops, plans: [plan] });
  return renderPlanHome(currentRepository);
}

type Screen = Awaited<ReturnType<typeof renderWith>>;

/** Opens the sheet from the bottom bar. */
async function openAdd(screen: Screen) {
  await screen.getByRole("button", { name: "注文を追加" }).click();
  const sheet = screen.getByRole("dialog", { name: "注文を追加" });
  await expect.element(sheet).toBeVisible();
  return sheet;
}

const amountOf = (sheet: ReturnType<Screen["getByRole"]>) => sheet.getByLabelText("金額（税込）");
const previewOf = () => document.querySelector("[data-preview]")?.textContent ?? "";

async function fillOrder(
  sheet: ReturnType<Screen["getByRole"]>,
  values: { shop?: string; amount: string; name?: string },
) {
  if (values.shop)
    await sheet.getByLabelText("ショップ", { exact: true }).selectOptions(values.shop);
  await sheet.getByLabelText("注文日").fill("2026-10-05");
  await amountOf(sheet).fill(values.amount);
  if (values.name) await sheet.getByLabelText("商品名メモ（任意）").fill(values.name);
}

test("adds an order and closes", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await expect.element(amountOf(sheet)).toHaveFocus();
  expect(sheet.getByLabelText("注文日").element()).toHaveProperty("value", tokyoToday(new Date()));

  await fillOrder(sheet, { shop: "ショップ4", amount: "3,300", name: "洗濯洗剤" });
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.element(sheet).not.toBeInTheDocument();
  await expect.poll(async () => (await stored()).length).toBe(5);
  expect((await stored()).at(-1)).toMatchObject({
    shopId: shopId(4),
    date: "2026-10-05",
    onHold: false,
    tags: [],
    lineItems: [{ name: "洗濯洗剤", unitPrice: 3300, quantity: 1, taxRate: 0.1, discount: 0 }],
  });
  await expect.element(screen.getByRole("button", { name: "注文を追加" })).toHaveFocus();
});

test("continue adding keeps the sheet open and clears the inputs", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "3300", name: "洗濯洗剤" });
  await sheet.getByRole("button", { name: "続けて追加" }).click();

  await expect.poll(async () => (await stored()).length).toBe(5);
  await expect.element(sheet).toBeVisible();
  await expect.element(amountOf(sheet)).toHaveValue("");
  await expect.element(amountOf(sheet)).toHaveFocus();
  await expect.element(sheet.getByLabelText("商品名メモ（任意）")).toHaveValue("");
  await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue("");

  await fillOrder(sheet, { shop: "ショップ5", amount: "1200" });
  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect
    .poll(async () => (await stored()).map((saved) => saved.shopId).slice(4))
    .toEqual([shopId(4), shopId(5)]);
});

test("invalid price is not saved", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "12a" });
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.element(amountOf(sheet)).toHaveAttribute("aria-invalid", "true");
  await expect.element(sheet.getByText("金額は0以上の整数で入れてください")).toBeVisible();
  // A screen reader reads the error with the field, which takes the focus.
  await expect
    .element(amountOf(sheet))
    .toHaveAccessibleDescription("金額は0以上の整数で入れてください");
  await expect.element(amountOf(sheet)).toHaveFocus();
  await expect.element(sheet).toBeVisible();

  await sheet.getByLabelText("ショップ", { exact: true }).selectOptions("ショップを選ぶ");
  await amountOf(sheet).fill("");
  await sheet.getByRole("button", { name: "続けて追加" }).click();
  await expect.element(sheet.getByText("ショップを選んでください")).toBeVisible();
  await expect
    .element(sheet.getByLabelText("ショップ", { exact: true }))
    .toHaveAccessibleDescription("ショップを選んでください");
  await expect.element(sheet.getByText("金額を入れてください")).toBeVisible();
  // The first field with an error on screen takes the focus.
  await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveFocus();
  expect(await stored()).toHaveLength(4);
});

test("tax-exempt item uses the same base amount", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "2980" });
  // 10% tax: ¥2,980 − floor(2,980 × 10 / 110) = ¥2,710 before tax.
  await expect.poll(previewOf).toContain("税抜 ¥2,710");

  const exempt = sheet.getByRole("button", { name: "非課税" });
  await exempt.click();
  await expect.element(exempt).toHaveAttribute("aria-pressed", "true");
  await expect
    .element(sheet.getByRole("button", { name: "10%" }))
    .toHaveAttribute("aria-pressed", "false");
  await expect.poll(previewOf).toContain("税抜 ¥2,980");

  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect.poll(async () => (await stored()).at(-1)?.lineItems[0]?.taxRate).toBe(0);
});

const repeatBenefit: Benefit = {
  ...baseBenefit,
  kind: "rate-bonus",
  id: "b0000000-0000-4000-8000-000000000010",
  category: "campaign",
  label: "リピート購入",
  conditions: { orderTags: ["repeat"] },
  params: { rate: 1, roundingUnit: "item" },
};

test("repeat chip sets the order tag", async () => {
  const screen = await renderWith(makePlan([baseBenefit, repeatBenefit], []));
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "11000" });
  await expect.poll(previewOf).toContain("× 1% → 100P");

  const chip = sheet.getByRole("button", { name: /^リピート購入/ });
  await expect.element(chip).toHaveTextContent("リピート購入 +1");
  await chip.click();
  await expect.element(chip).toHaveAttribute("aria-pressed", "true");
  await expect.poll(previewOf).toContain("× 2% → 200P");

  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect.poll(async () => (await stored()).at(-1)?.tags).toEqual(["repeat"]);
});

test("39shop chip marks the shop", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "3300" });
  const chip = sheet.getByRole("button", { name: /^39ショップ/ });
  await expect.element(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect.element(chip).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.poll(async () => (await storedShop(shopId(4)))?.tags).toEqual(["39shop"]);
  expect((await stored()).at(-1)?.shopId).toBe(shopId(4));
});

test("preview shows the next shop count and points", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "11,000" });

  // ¥10,000 before tax at 通常 1 + SPU 2 + marathon 4 (5 shops) = 7%.
  await expect.poll(previewOf).toContain("この注文で（5店舗目としてカウント）");
  expect(previewOf()).toContain("税抜 ¥10,000 × 7% → 700P");
  // The four other orders of ¥10,000 each go from +3倍 to +4倍.
  expect(previewOf()).toContain("買い回りが +1倍 になり、ほかの注文も +400P");

  // A shop that already counts adds no shop.
  await sheet.getByLabelText("ショップ", { exact: true }).selectOptions("ショップ0");
  await expect.poll(previewOf).toContain("税抜 ¥10,000 × 6% → 600P");
  expect(previewOf()).not.toContain("店舗目");
  expect(previewOf()).not.toContain("買い回り");
});

test("pasting an Ichiba URL selects the matching shop", async () => {
  const withCode = shops.map((shop, index) =>
    index === 4 ? { ...shop, shopCode: "shop-four", tags: ["39shop" as const] } : shop,
  );
  const screen = await renderWith(marathonPlan(), withCode);
  const sheet = await openAdd(screen);
  const readText = vi
    .spyOn(navigator.clipboard, "readText")
    .mockResolvedValue("https://item.rakuten.co.jp/shop-four/item-1/");

  await sheet.getByRole("button", { name: "貼り付け" }).click();
  await expect
    .element(sheet.getByLabelText(/^商品のURL/))
    .toHaveValue("https://item.rakuten.co.jp/shop-four/item-1/");
  await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue(shopId(4));
  await expect
    .element(sheet.getByRole("button", { name: /^39ショップ/ }))
    .toHaveAttribute("aria-pressed", "true");
  readText.mockRestore();

  // A code that is not in the registry starts a new shop with that code.
  await sheet.getByLabelText(/^商品のURL/).fill("https://item.rakuten.co.jp/coffee-beans/x/");
  await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue("new");
  await expect.element(sheet.getByLabelText("新しいショップの名前")).toHaveValue("coffee-beans");
  await expect.element(sheet.getByLabelText("購入先")).toHaveValue("rakuten-ichiba");
  await sheet.getByLabelText("注文日").fill("2026-10-05");
  await amountOf(sheet).fill("1000");
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.poll(async () => (await stored()).length).toBe(5);
  const saved = (await repository().shops.list()).find((shop) => shop.name === "coffee-beans");
  expect(saved).toMatchObject({ channel: "rakuten-ichiba", shopCode: "coffee-beans", tags: [] });
  expect((await stored()).at(-1)?.shopId).toBe(saved?.id);
  expect((await stored()).at(-1)?.lineItems[0]?.url).toBe(
    "https://item.rakuten.co.jp/coffee-beans/x/",
  );
});

test("a URL that names no shop is described and does not mark the field invalid", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  const url = sheet.getByLabelText(/^商品のURL/);
  await url.fill("https://example.com/item");
  await expect.element(url).toHaveAccessibleDescription("このURLからはショップを選べません");
  await expect.element(url).not.toHaveAttribute("aria-invalid");
});

test("a URL that is not a web address is an error, and nothing is saved", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "1000" });
  const url = sheet.getByLabelText(/^商品のURL/);
  await url.fill("item.rakuten.co.jp/shop/item/");
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.element(url).toHaveAttribute("aria-invalid", "true");
  await expect
    .element(url)
    .toHaveAccessibleDescription("商品のURLは https:// で始まる形で入れてください");
  await expect.element(url).toHaveFocus();
  expect(await stored()).toHaveLength(4);

  // The error follows each input once it is shown.
  await url.fill("https://item.rakuten.co.jp/shop/item/");
  await expect.element(url).not.toHaveAttribute("aria-invalid");
});

test("an error in the closed details opens them and takes the focus", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "1000" });
  const details = sheet.getByText(/^詳細設定/);
  await details.click();
  const quantity = sheet.getByLabelText("数量");
  await quantity.fill("0");
  await details.click();
  expect(document.querySelector("details")?.open).toBe(false);
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.element(quantity).toHaveAccessibleDescription("数量は1以上の整数で入れてください");
  await expect.element(quantity).toHaveFocus();
  expect(document.querySelector("details")?.open).toBe(true);
  expect(await stored()).toHaveLength(4);
});

test("editing an order shows its stored URL and keeps it", async () => {
  const url = "https://item.rakuten.co.jp/shop-one/item-9/";
  const withUrl = order(1);
  const [item] = withUrl.lineItems;
  if (!item) throw new Error("no item");
  const plan = marathonPlan([order(0), { ...withUrl, lineItems: [{ ...item, url }] }]);
  const screen = await renderWith(plan);
  const card = screen.getByRole("listitem").filter({ hasText: "ショップ1" });
  await card.getByRole("button", { expanded: false }).first().click();
  await card.getByRole("button", { name: "編集" }).click();

  const sheet = screen.getByRole("dialog", { name: "注文を編集" });
  await expect.element(sheet.getByLabelText(/^商品のURL/)).toHaveValue(url);
  await amountOf(sheet).fill("5500");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect.poll(async () => (await stored())[1]?.lineItems[0]?.unitPrice).toBe(5500);
  expect((await stored())[1]?.lineItems[0]?.url).toBe(url);
});

test("details set quantity, coupon, shop rate, hold and another item", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "1100", name: "洗剤" });

  const details = sheet.getByText(/^詳細設定/);
  await details.click();
  await sheet.getByLabelText("数量").fill("3");
  await sheet.getByLabelText("クーポン値引額（税込）").fill("300");
  await sheet.getByLabelText("ショップ独自倍率").fill("2");
  const hold = sheet.getByRole("switch", { name: "保留（計算から外す）" });
  // The whole row is the switch's label, so the tap target is the row's height.
  const row = hold.element().closest("label");
  expect(row?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  await sheet.getByText("保留（計算から外す）").click();
  await expect.element(hold).toBeChecked();
  (hold.element() as HTMLElement).focus();
  await userEvent.keyboard(" ");
  await expect.element(hold).not.toBeChecked();
  await userEvent.keyboard(" ");
  await expect.element(hold).toBeChecked();
  await sheet.getByRole("button", { name: "＋ 同じショップの商品を追加" }).click();

  const second = sheet.getByRole("group", { name: "商品2" });
  await expect.element(second).toBeVisible();
  await second.getByLabelText("商品名メモ").fill("柔軟剤");
  await second.getByLabelText("金額（税込）").fill("550");
  await second.getByRole("combobox", { name: "税率" }).selectOptions("8%");
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect.poll(async () => (await stored()).length).toBe(5);
  expect((await stored()).at(-1)).toMatchObject({
    onHold: true,
    lineItems: [
      { name: "洗剤", unitPrice: 1100, quantity: 3, discount: 300, shopPointRate: 2, taxRate: 0.1 },
      { name: "柔軟剤", unitPrice: 550, quantity: 1, discount: 0, taxRate: 0.08 },
    ],
  });
});

test("an invalid amount of another item is described on its field", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "1000" });
  await sheet.getByText(/^詳細設定/).click();
  await sheet.getByRole("button", { name: "＋ 同じショップの商品を追加" }).click();
  const second = sheet.getByRole("group", { name: "商品2" });
  await second.getByLabelText("金額（税込）").fill("12a");
  await sheet.getByRole("button", { name: "追加する" }).click();

  const amount = second.getByLabelText("金額（税込）");
  await expect.element(amount).toHaveAttribute("aria-invalid", "true");
  await expect.element(amount).toHaveAccessibleDescription("金額は0以上の整数で入れてください");
  await expect.element(amount).toHaveFocus();
  expect(await stored()).toHaveLength(4);
});

test("a coupon larger than the item is not saved", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "1000" });
  await sheet.getByText(/^詳細設定/).click();
  await sheet.getByLabelText("クーポン値引額（税込）").fill("1001");
  await sheet.getByRole("button", { name: "追加する" }).click();

  await expect
    .element(sheet.getByLabelText("クーポン値引額（税込）"))
    .toHaveAttribute("aria-invalid", "true");
  await expect
    .element(sheet.getByLabelText("クーポン値引額（税込）"))
    .toHaveAccessibleDescription("クーポン値引額は、金額に数量を掛けた額以下で入れてください");
  expect(await stored()).toHaveLength(4);
});

test("editing an order from its card saves the changes", async () => {
  const screen = await renderWith();
  const card = screen.getByRole("listitem").filter({ hasText: "ショップ1" });
  await card.getByRole("button", { expanded: false }).first().click();
  await card.getByRole("button", { name: "編集" }).click();

  const sheet = screen.getByRole("dialog", { name: "注文を編集" });
  await expect.element(sheet).toBeVisible();
  await expect.element(amountOf(sheet)).toHaveValue("11000");
  await expect.element(amountOf(sheet)).toHaveFocus();
  await expect.element(sheet.getByLabelText("ショップ", { exact: true })).toHaveValue(shopId(1));
  await expect.element(sheet.getByRole("button", { name: "続けて追加" })).not.toBeInTheDocument();
  // Editing the order does not add a shop: the order's own figures only.
  await expect.poll(previewOf).toContain("税抜 ¥10,000 × 6% → 600P");

  await amountOf(sheet).fill("5,500");
  await sheet.getByRole("button", { name: "保存する" }).click();
  await expect.element(sheet).not.toBeInTheDocument();

  await expect.poll(async () => (await stored())[1]?.lineItems[0]?.unitPrice).toBe(5500);
  const saved = (await stored())[1];
  expect(saved?.id).toBe(orderId(1));
  expect(saved?.lineItems[0]?.id).toBe(order(1).lineItems[0]?.id);
  expect(await stored()).toHaveLength(4);
});

test("closing the sheet saves nothing", async () => {
  const screen = await renderWith();
  const sheet = await openAdd(screen);
  await fillOrder(sheet, { shop: "ショップ4", amount: "3300" });
  await sheet.getByRole("button", { name: "閉じる" }).click();
  await expect.element(sheet).not.toBeInTheDocument();

  await openAdd(screen);
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(await stored()).toHaveLength(4);
});

test("on a desktop a multi-item order is edited in a dialog", async () => {
  await page.viewport(1280, 900);
  const plan = makePlan(
    [baseBenefit, spuBenefit, ...marathon],
    [order(0, { items: 2 }), order(1), order(2), order(3)],
  );
  const screen = await renderWith(plan);
  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();
  await screen.getByRole("button", { name: "商品を編集" }).click();

  const dialog = screen.getByRole("dialog", { name: "注文を編集" });
  await expect.element(dialog).toBeVisible();
  const second = dialog.getByRole("group", { name: "商品2" });
  await expect.element(second.getByLabelText("金額（税込）")).toHaveValue("11000");
  await second.getByLabelText("金額（税込）").fill("2200");
  await dialog.getByRole("button", { name: "保存する" }).click();
  await expect.element(dialog).not.toBeInTheDocument();

  await expect
    .poll(async () => (await stored())[0]?.lineItems.map((item) => item.unitPrice))
    .toEqual([11000, 2200]);
});

test("an edit= for an order that does not exist is dropped from the URL", async () => {
  currentRepository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(currentRepository, `/plan?id=${PLAN}&edit=${orderId(9)}`);
  await expect.poll(() => screen.router.state.location.search).toEqual({ id: PLAN });
  expect(screen.router.history.length).toBe(1);
  expect(document.querySelector("[role=dialog]")).toBeNull();
});
