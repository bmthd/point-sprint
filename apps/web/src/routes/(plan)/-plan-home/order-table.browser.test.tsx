import type { Order } from "@workspaces/domain";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { updateOrderAtom } from "../../../state/order-ops";
import { plansQueryAtom, shopsQueryAtom } from "../../../state/queries";
import { createMemoryRepository } from "../../../storage/memory-repository";
import { DATE_PICKER_FIELD, misalignedFields } from "../../../test-layout";
import { expectTexts } from "../../../test-texts";
import { OrderTable } from "./order-table";
import {
  PLAN,
  Providers,
  baseBenefit,
  campaignBenefit,
  expectShopsInOrder,
  makePlan,
  marathon,
  marathonPlan,
  order,
  orderId,
  renderPlanHome,
  shopId,
  shops,
  spuBenefit,
  summary,
  tapCard,
} from "../-test-fixtures";

const rowRenders = vi.hoisted(() => new Map<string, number>());

// Every row is wrapped in a Profiler that counts its commits by order id. The wrapper keeps the
// row's own `memo` (and its comparison), so the list renders rows exactly as it does in the app.
vi.mock("./order-row", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./order-row")>();
  const { createElement, memo, Profiler: ProfilerComponent } = await import("react");
  type Props = Parameters<typeof actual.OrderRow>[0];
  const row = actual.OrderRow as unknown as {
    type?: (props: Props) => ReactNode;
    compare?: (a: Props, b: Props) => boolean;
  };
  const Inner = (row.type ?? actual.OrderRow) as (props: Props) => ReactNode;
  const Counted = (props: Props) =>
    createElement(
      ProfilerComponent,
      {
        id: props.orderId,
        onRender: (id: string) => rowRenders.set(id, (rowRenders.get(id) ?? 0) + 1),
      },
      createElement(Inner, props),
    );
  return { ...actual, OrderRow: row.type ? memo(Counted, row.compare ?? undefined) : Counted };
});

beforeEach(async () => {
  await page.viewport(1280, 900);
});

// The list is named by its heading, 「注文 4件」.
const list = () => page.getByRole("list", { name: /^注文 \d+件/ });
// An order's row is the item with its reorder handle; the add form and the open row's legend are not.
const rows = () =>
  list()
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: /の注文を並べ替え$/ }) });
const rowOf = (shop: string) =>
  list()
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: `${shop}の注文を並べ替え` }) });
const cards = () => page.getByRole("list", { name: "注文", exact: true });
const heading = () =>
  page.getByRole("region", { name: "注文のリスト" }).getByRole("heading", { level: 2 });
const stored = async () => (await repository().plans.get(PLAN))?.orders;
let currentRepository: ReturnType<typeof createMemoryRepository> | undefined;
const repository = () => {
  if (!currentRepository) throw new Error("no repository");
  return currentRepository;
};

async function renderWith(plan = marathonPlan(), withShops = shops) {
  currentRepository = createMemoryRepository({ shops: withShops, plans: [plan] });
  return renderPlanHome(currentRepository);
}

async function openAddForm(screen: Awaited<ReturnType<typeof renderPlanHome>>) {
  const toggle = screen.getByRole("button", { name: /注文を追加/ });
  await expect.element(toggle).toBeVisible();
  if (screen.getByRole("button", { name: /注文を追加/, expanded: false }).length) {
    await toggle.click();
  }
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
}

test("the list replaces the cards from 1024px", async () => {
  await renderWith();
  await expect.element(rows()).toHaveLength(4);
  await expect.element(cards()).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("region", { name: "注文のリスト" }).getByRole("table"))
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByText("表示は目安です。実際の付与ポイントとは誤差が出ることがあります。", {
        exact: false,
      }),
    )
    .toBeInTheDocument();

  await page.viewport(1000, 900);
  await expect.element(cards()).toBeInTheDocument();
  await expect.element(list()).not.toBeInTheDocument();
});

test("each row shows the order's shop, items, amount, points and rate", async () => {
  await renderWith(
    makePlan(
      [baseBenefit, spuBenefit, campaignBenefit, ...marathon],
      [order(0, { items: 2 }), order(1), order(2), order(3)],
    ),
  );

  await expect.element(rows()).toHaveLength(4);
  const row = rowOf("ショップ0");
  // ¥20,000 before tax at 通常 1 + SPU 2 + campaign 1 + marathon 3 = 7倍 is 1,400P.
  await expect.element(row.getByText("1", { exact: true })).toBeVisible();
  for (const text of [
    "10/5（月）",
    "商品0-1 他1点",
    "0と5のつく日",
    "¥22,000",
    "10%",
    "1,400P",
    "7倍",
  ]) {
    await expect.element(row).toMatchTextContent(text);
  }
});

test("fits 1024px without horizontal scroll", async () => {
  await page.viewport(1024, 900);
  const long = "とても長い名前のショップ".repeat(6);
  const wideShops = shops.map((shop, index) => (index === 0 ? { ...shop, name: long } : shop));
  const wide = order(0);
  wide.lineItems = wide.lineItems.map((item) => ({ ...item, name: "長い商品名".repeat(20) }));
  const screen = await renderWith(
    makePlan([baseBenefit, spuBenefit, campaignBenefit, ...marathon], [wide, order(1)]),
    wideShops,
  );

  await expect.element(rows()).toHaveLength(2);
  await screen.getByRole("button", { name: `${long}の注文の詳細と編集` }).click();
  await openAddForm(screen);
  // The add form comes after the open row, so its shop field is the last one.
  await screen
    .getByRole("combobox", { name: "ショップ" })
    .last()
    .selectOptions("＋ 新しいショップ");

  // Every control is at least 44px both ways (the switch through its label). Sizes are read from
  // the elements: no matcher measures them.
  const controls = [
    screen.getByRole("button", { name: `${long}の注文を並べ替え` }).element(),
    screen
      .getByRole("switch", { name: `${long}の注文を購入決定` })
      .element()
      .closest("label"),
    screen.getByRole("button", { name: `${long}の注文の詳細と編集` }).element(),
    // A date picker's box, not its input, is what is tapped.
    ...Array.from(
      list().element().querySelectorAll("input:not([type=checkbox]), select, button"),
      (control) => control.closest(DATE_PICKER_FIELD) ?? control,
    ),
  ];
  for (const control of controls) {
    const { width, height } = (control as HTMLElement).getBoundingClientRect();
    expect(
      Math.min(width, height),
      (control as HTMLElement).outerHTML.slice(0, 80),
    ).toBeGreaterThanOrEqual(44);
  }

  const element = list().element();
  expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
  for (const row of rows().elements()) {
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  }
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
});

test("enter in the add form adds an order and refocuses the first field", async () => {
  // The new order is dated today, so today is in the plan's period (10/4 to 10/9) for it to count.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));

  await expect.element(rows()).toHaveLength(1);
  await openAddForm(screen);
  const url = screen.getByRole("textbox", { name: "商品のURL（貼るとショップを選びます）" });
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "ショップ" }), "ショップ4");
  await screen.getByRole("textbox", { name: "商品名メモ" }).fill("フェイスタオル");
  await screen.getByRole("textbox", { name: "金額（税込）" }).fill("11,000");
  // ¥10,000 before tax at 通常 1倍, at a second shop.
  await expect
    .element(screen.getByRole("status", { name: "ポイントの目安" }))
    .toHaveTextContent("この注文で（2店舗目） 約 +100P");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "税率" }), "8%");
  await screen.getByRole("textbox", { name: "金額（税込）" }).click();
  await userEvent.keyboard("{Enter}");

  await expectShopsInOrder(rows(), ["ショップ0", "ショップ4"]);
  await expect.element(rowOf("ショップ4")).toMatchTextContent("¥11,000");
  await expect.element(url).toHaveFocus();
  await expect
    .element(screen.getByRole("button", { name: /注文を追加/ }))
    .toHaveAttribute("aria-expanded", "true");
  await expect.element(screen.getByRole("combobox", { name: "ショップ" })).toHaveValue("");
  await expect.element(screen.getByRole("textbox", { name: "商品名メモ" })).toHaveValue("");
  await expect.element(screen.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  expect((await stored())?.[1]).toMatchObject({
    shopId: shopId(4),
    date: "2026-10-05",
    onHold: false,
    tags: [],
    lineItems: [{ name: "フェイスタオル", unitPrice: 11000, quantity: 1, taxRate: 0.08 }],
  });
});

test("an invalid add form shows errors and saves nothing", async () => {
  const screen = await renderWith(marathonPlan([order(0)]));

  await expect.element(rows()).toHaveLength(1);
  await openAddForm(screen);
  const amount = screen.getByRole("textbox", { name: "金額（税込）" });
  await amount.fill("abc");
  await userEvent.keyboard("{Enter}");

  await expect.element(screen.getByText("金額は0以上の整数で入れてください")).toBeVisible();
  await expect.element(amount).toHaveAttribute("aria-invalid", "true");
  // The first field with an error takes the focus.
  await expect.element(amount).toHaveFocus();
  await expect.element(amount).toHaveValue("abc");
  await expect.element(rows()).toHaveLength(1);
  expect((await stored())?.length).toBe(1);
});

test("an error under one field leaves the other fields of its row in place", async () => {
  const screen = await renderWith(marathonPlan([order(0)]));
  await expect.element(rows()).toHaveLength(1);
  await openAddForm(screen);
  // Its error takes two lines, the tallest under the add form's fields.
  await screen.getByRole("textbox", { name: "ショップ独自倍率" }).fill("0.5");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByText("ショップ独自倍率は1以上の数で入れてください"))
    .toBeVisible();

  const form = list()
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: /注文を追加/ }) });
  // Positions are read from the elements: no matcher measures them.
  expect(misalignedFields(form.element())).toEqual([]);
});

test("a failed save keeps the add form's input", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);
  repository().plans.put = async () => {
    throw new Error("disk full");
  };

  await openAddForm(screen);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "ショップ" }), "ショップ4");
  const amount = screen.getByRole("textbox", { name: "金額（税込）" });
  await amount.fill("3300");
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();
  await expect.element(amount).toHaveValue("3300");
  await expect.element(rows()).toHaveLength(1);
  expect((await stored())?.length).toBe(1);
});

test("an edit whose save failed can be saved again", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();
  const put = repository().plans.put.bind(repository().plans);
  let failNext = true;
  repository().plans.put = (plan) => {
    if (failNext) {
      failNext = false;
      return Promise.reject(new Error("disk full"));
    }
    return put(plan);
  };

  const amount = () => screen.getByRole("textbox", { name: "金額（税込）" });
  await amount().fill("22,000");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥11,000");

  await amount().fill("22,000");
  await userEvent.keyboard("{Enter}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(22000);
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥22,000");
});

test("a pasted URL picks the shop, or starts a new one", async () => {
  const withCodes = shops.map((shop, index) =>
    index === 4 ? { ...shop, shopCode: "shop-four", tags: ["39shop" as const] } : shop,
  );
  const screen = await renderWith(marathonPlan([]), withCodes);

  await openAddForm(screen);
  const url = screen.getByRole("textbox", { name: "商品のURL（貼るとショップを選びます）" });
  const shop = screen.getByRole("combobox", { name: "ショップ" });
  await url.fill("https://item.rakuten.co.jp/shop-four/item-1/");
  await expect.element(shop).toHaveValue(shopId(4));
  await expect.element(screen.getByRole("checkbox", { name: "39ショップ" })).toBeChecked();

  await url.fill("https://item.rakuten.co.jp/coffee-beans/item-2/");
  await expect.element(shop).toHaveValue("new");
  const name = screen.getByRole("textbox", { name: "新しいショップの名前" });
  await expect.element(name).toHaveValue("coffee-beans");
  await name.fill("コーヒー豆の店");
  await tapCard(screen.getByRole("checkbox", { name: "リピート購入" }));
  await screen.getByRole("textbox", { name: "金額（税込）" }).fill("2160");
  await screen.getByRole("button", { name: "追加する" }).click();

  await expect.element(rows().first()).toMatchTextContent("コーヒー豆の店");
  const saved = (await repository().shops.list()).find((s) => s.name === "コーヒー豆の店");
  expect(saved).toMatchObject({ channel: "rakuten-ichiba", shopCode: "coffee-beans", tags: [] });
  await expect.poll(async () => (await stored())?.[0]?.shopId).toBe(saved?.id);
  expect((await stored())?.[0]?.tags).toEqual(["repeat"]);
});

test("keyboard reorder with the handle", async () => {
  const screen = await renderWith();

  await expect.element(rows()).toHaveLength(4);
  const handle = screen.getByRole("button", { name: "ショップ0の注文を並べ替え" });
  // Locators have no focus().
  handle.element().focus();
  await userEvent.keyboard("{ArrowDown}");

  await expectShopsInOrder(rows(), ["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
  await expect.element(handle).toHaveFocus();
  await expect
    .element(screen.getByText("ショップ0の注文を2番目に移動しました"))
    .toBeInTheDocument();

  await userEvent.keyboard("{ArrowDown}");
  await expectShopsInOrder(rows(), ["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect.element(handle).toHaveFocus();

  await userEvent.keyboard("{ArrowUp}");
  await expectShopsInOrder(rows(), ["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
  await expect
    .poll(async () => (await stored())?.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(0), shopId(2), shopId(3)]);

  // The first order cannot go further up.
  screen.getByRole("button", { name: "ショップ1の注文を並べ替え" }).element().focus();
  await userEvent.keyboard("{ArrowUp}");
  await new Promise((resolve) => setTimeout(resolve, 50));
  await expectShopsInOrder(rows(), ["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
});

test("moving an order with its handle closes the opened one", async () => {
  const screen = await renderWith();
  const opened = screen.getByRole("button", { name: "ショップ2の注文の詳細と編集" });
  await opened.click();
  await expect.element(opened).toHaveAttribute("aria-expanded", "true");

  // Locators have no focus().
  screen.getByRole("button", { name: "ショップ0の注文を並べ替え" }).element().focus();
  await userEvent.keyboard("{ArrowDown}");

  await expect.element(opened).toHaveAttribute("aria-expanded", "false");
});

test("drag the handle onto another row to reorder", async () => {
  const screen = await renderWith();

  await expect.element(rows()).toHaveLength(4);
  // The drag's own events are listened for on the list's element: no matcher sees them.
  const events: string[] = [];
  for (const type of ["pointercancel", "dragstart", "drop", "dragend"]) {
    list()
      .element()
      .addEventListener(type, () => events.push(type));
  }
  await userEvent.dragAndDrop(
    screen.getByRole("button", { name: "ショップ0の注文を並べ替え" }),
    screen.getByRole("button", { name: "ショップ2の注文の詳細と編集" }),
  );

  await expectShopsInOrder(rows(), ["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect
    .poll(async () => (await stored())?.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(2), shopId(0), shopId(3)]);
  // The move went through the browser's own drag and drop, started from the handle.
  expect(events).toContain("dragstart");
  expect(events).toContain("drop");
  expect(events.at(-1)).toBe("dragend");
});

test("購入決定 switch toggles hold", async () => {
  const screen = await renderWith();

  await expect.element(summary()).toMatchTextContent("4店舗を買い回り中");
  const counted = screen.getByRole("switch", { name: "ショップ1の注文を購入決定" });
  await expect.element(counted).toBeChecked();
  // The input itself is visually hidden; a click lands on the box drawn in its label. Locators
  // cannot reach an element's parent, so the label is found from the input.
  await userEvent.click(counted.element().closest("label") as HTMLElement);

  await expect.element(counted).not.toBeChecked();
  await expect.element(summary()).toMatchTextContent("3店舗を買い回り中");
  await expect.element(heading()).toHaveTextContent("注文 4件（保留 1）");
  await expect.element(rowOf("ショップ1").getByText("保留", { exact: true })).toBeVisible();
  await expect.element(rowOf("ショップ2").getByText("2", { exact: true })).toBeVisible();
  // Held, it shows struck the points it had counted: 通常 100 + SPU 200 + the marathon at +3倍 on
  // four shops (300).
  await expect
    .element(rowOf("ショップ1").getByText("保留中の見込み 600P", { exact: true }))
    .toBeInTheDocument();
  await expect.poll(async () => (await stored())?.[1]?.onHold).toBe(true);

  // With the keyboard: Space on the focused switch counts it again.
  counted.element().focus();
  await userEvent.keyboard(" ");
  await expect.element(summary()).toMatchTextContent("4店舗を買い回り中");
});

test("expanded row shows group totals and edits the order", async () => {
  const screen = await renderWith(
    makePlan(
      [baseBenefit, spuBenefit, campaignBenefit, ...marathon],
      [order(0), order(1), order(2), order(3)],
    ),
  );

  const details = screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" });
  await expect.element(details).toHaveAttribute("aria-expanded", "false");
  await details.click();
  await expect.element(details).toHaveAttribute("aria-expanded", "true");

  const row = rowOf("ショップ0");
  // ¥10,000 before tax: 通常 1倍, SPU 2倍, マラソン 3倍, 0と5のつく日 1倍.
  await expectTexts(row.getByRole("list", { name: "ポイントの内訳" }).getByRole("listitem"), [
    "通常100P",
    "SPU200P",
    "マラソン300P",
    "キャンペーン100P",
  ]);
  await expect.element(row).toMatchTextContent("税抜の基準額 ¥10,000");

  let saves = 0;
  const put = repository().plans.put.bind(repository().plans);
  repository().plans.put = (plan) => {
    saves += 1;
    return put(plan);
  };

  // Text fields save on Enter, and only when valid.
  const amount = screen.getByRole("textbox", { name: "金額（税込）" });
  await amount.fill("abc");
  await userEvent.keyboard("{Enter}");
  await expect.element(amount).toHaveAttribute("aria-invalid", "true");
  expect((await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(11000);

  await screen.getByRole("textbox", { name: "金額（税込）" }).fill("22,000");
  // Leaving the field right after Enter does not save the same value again.
  await userEvent.keyboard("{Enter}{Tab}");
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥22,000");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(saves).toBe(1);
  await screen.getByRole("textbox", { name: "商品名メモ" }).fill("バスタオル");
  await userEvent.keyboard("{Enter}");
  await expect.element(rowOf("ショップ0")).toMatchTextContent("バスタオル");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "税率" }), "8%");
  // The closed add form's date field is the second one.
  await screen.getByLabelText("注文日").first().fill("2026/10/07");
  await screen.getByRole("textbox", { name: "ショップ独自倍率" }).fill("3");
  await userEvent.keyboard("{Enter}");
  await tapCard(screen.getByRole("checkbox", { name: "リピート購入" }));
  await expect.element(screen.getByRole("checkbox", { name: "リピート購入" })).toBeChecked();

  await expect
    .poll(async () => (await stored())?.[0])
    .toMatchObject({
      date: "2026-10-07",
      tags: ["repeat"],
      lineItems: [{ name: "バスタオル", unitPrice: 22000, taxRate: 0.08, shopPointRate: 3 }],
    });

  const shopTag = screen.getByRole("checkbox", { name: "39ショップ" });
  await expect
    .element(shopTag)
    .toHaveAccessibleDescription("このショップの注文すべてに反映されます");
  await tapCard(shopTag);
  await expect
    .poll(async () => (await repository().shops.list()).find((s) => s.id === shopId(0))?.tags)
    .toEqual(["39shop"]);

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "ショップ" }), "ショップ5");
  await expect.poll(async () => (await stored())?.[0]?.shopId).toBe(shopId(5));

  // 複製 and 削除 work from the expanded row.
  await screen.getByRole("button", { name: "複製" }).click();
  await expect.element(rows()).toHaveLength(5);
  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.element(rows()).toHaveLength(4);
});

test("leaving a field of an opened row unchanged saves nothing", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  let saves = 0;
  const put = repository().plans.put.bind(repository().plans);
  repository().plans.put = (plan) => {
    saves += 1;
    return put(plan);
  };
  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();

  await screen.getByRole("textbox", { name: "金額（税込）" }).click();
  await userEvent.keyboard("{Tab}{Tab}");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(saves).toBe(0);
});

test("an opened row puts its order at a new shop", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();

  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "ショップ" }).first(),
    "＋ 新しいショップ",
  );
  await screen.getByRole("textbox", { name: "新しいショップの名前" }).fill("はじめての店");
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByRole("button", { name: "はじめての店の注文の詳細と編集" }))
    .toBeVisible();
  const created = (await repository().shops.list()).find((shop) => shop.name === "はじめての店");
  expect((await stored())?.[0]?.shopId).toBe(created?.id);
  // Saved once: the field now names the shop, and leaving it makes no second one.
  await userEvent.keyboard("{Tab}");
  await expect
    .poll(async () =>
      (await repository().shops.list()).filter((shop) => shop.name === "はじめての店"),
    )
    .toHaveLength(1);
});

test("the add form and an opened row take turns, and the form keeps what was typed", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  const add = screen.getByRole("button", { name: /注文を追加/ });
  const row = screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" });

  await add.click();
  await screen.getByRole("textbox", { name: "商品名メモ" }).fill("あとで足す");
  await row.click();
  await expect.element(row).toHaveAttribute("aria-expanded", "true");
  await expect.element(add).toHaveAttribute("aria-expanded", "false");

  await add.click();
  await expect.element(row).toHaveAttribute("aria-expanded", "false");
  await expect
    .element(screen.getByRole("textbox", { name: "商品名メモ" }))
    .toHaveValue("あとで足す");
});

test("a row of several items does not edit their tax and shop rates inline", async () => {
  const several = order(0, { items: 2 });
  several.lineItems = several.lineItems.map((item, index) => ({
    ...item,
    taxRate: index === 0 ? 0.1 : 0.08,
    shopPointRate: index === 0 ? 2 : 3,
  }));
  const screen = await renderWith(marathonPlan([several, order(1), order(2), order(3)]));

  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();
  const panel = screen.getByRole("listitem").filter({ hasText: "商品を編集" });
  await expect.element(panel.getByRole("button", { name: "商品を編集" })).toBeVisible();
  await expect.element(panel.getByRole("combobox", { name: "税率" })).not.toBeInTheDocument();
  await expect
    .element(panel.getByRole("textbox", { name: "ショップ独自倍率" }))
    .not.toBeInTheDocument();
  await expect.element(panel.getByText("商品ごとに異なります")).toHaveLength(2);

  // A change to the order's own fields leaves each item's rates as they were.
  await tapCard(screen.getByRole("checkbox", { name: "リピート購入" }));
  await expect.poll(async () => (await stored())?.[0]?.tags).toEqual(["repeat"]);
  expect(
    (await stored())?.[0]?.lineItems.map((item) => [item.taxRate, item.shopPointRate]),
  ).toEqual([
    [0.1, 2],
    [0.08, 3],
  ]);
});

test("editing one order does not re-render the other rows", async () => {
  await cleanup();
  const plan = makePlan([baseBenefit, spuBenefit, campaignBenefit], [order(0), order(1)]);
  const memory = createMemoryRepository({ shops, plans: [plan] });
  let updateOrder: ((order: Order) => Promise<unknown>) | undefined;
  const noop = () => {};

  function Loaded() {
    const plans = useAtomValue(plansQueryAtom);
    const loadedShops = useAtomValue(shopsQueryAtom);
    const update = useSetAtom(updateOrderAtom);
    useEffect(() => {
      updateOrder = (next) => update({ planId: PLAN, order: next });
    }, [update]);
    const loaded = plans.data?.find((p) => p.id === PLAN);
    return loadedShops.isSuccess && loaded ? <OrderTable plan={loaded} onEdit={noop} /> : null;
  }

  rowRenders.clear();
  const screen = await render(
    <Providers repository={memory}>
      <Loaded />
    </Providers>,
  );

  await expect.element(rowOf("ショップ0")).toMatchTextContent("400P");
  await expect.element(rowOf("ショップ1")).toMatchTextContent("400P");
  const before = rowRenders.get(orderId(1));

  const edited = order(0);
  edited.lineItems = edited.lineItems.map((item) => ({ ...item, unitPrice: 22000 }));
  await updateOrder?.(edited);

  await expect.element(rowOf("ショップ0")).toMatchTextContent("800P");
  // Wait for the refetch that follows the save to settle as well.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(rowRenders.get(orderId(0))).toBeGreaterThan(1);
  expect(rowRenders.get(orderId(1))).toBe(before);
  await expect.element(screen.locator).toMatchTextContent("¥22,000");
});
