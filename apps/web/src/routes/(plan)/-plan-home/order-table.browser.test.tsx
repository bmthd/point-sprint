import type { Order } from "@workspaces/domain";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { beforeEach, expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { updateOrderAtom } from "#/state/plan-operations.ts";
import { plansQueryAtom, shopsQueryAtom } from "#/state/queries.ts";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import { DATE_PICKER_FIELD, misalignedFields, tapArea } from "#/test-layout.ts";
import { expectTexts } from "#/test-texts.ts";
import { OrderTable } from "./order-table.tsx";
import {
  PLAN,
  Providers,
  baseBenefit,
  enterShop,
  campaignBenefit,
  expectShopsInOrder,
  makePlan,
  marathon,
  marathonPlan,
  order,
  orderId,
  renderPlanHome,
  shopField,
  shopId,
  shops,
  spuBenefit,
  summary,
  tapCard,
  urlField,
} from "#/routes/(plan)/-test-fixtures.tsx";

const rowRenders = vi.hoisted(() => new Map<string, number>());

// Every row is wrapped in a Profiler that counts its commits by order id. The wrapper keeps the
// row's own `memo` (and its comparison), so the list renders rows exactly as it does in the app.
vi.mock("./order-row.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./order-row.tsx")>();
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

// The empty row at the end of the list, where a new order is typed.
const newName = () => page.getByRole("textbox", { name: "新しい注文の商品名" });
const newAmount = () => page.getByRole("textbox", { name: "新しい注文の金額" });
const newOrderRow = () =>
  list()
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "新しい注文の条件" }) });

/** Opens the conditions of the order being typed in the add row. */
async function openNewOrder(screen: Awaited<ReturnType<typeof renderPlanHome>>) {
  const toggle = screen.getByRole("button", { name: "新しい注文の条件" });
  if (toggle.element().getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(shopField(newOrderRow())).toBeVisible();
}

test("the list replaces the cards from 977px, where the screen has two columns", async () => {
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

  await page.viewport(977, 900);
  await expect.element(cards()).not.toBeInTheDocument();
  await page.viewport(976, 900);
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

for (const onHold of [false, true]) {
  test(`fully capped ${onHold ? "held" : "counted"} row omits the marathon contribution`, async () => {
    const capped = structuredClone(marathon);
    for (const benefit of capped) benefit.params.cap = 0;
    await renderWith(
      makePlan(
        [baseBenefit, spuBenefit, ...capped],
        [order(0), order(1), order(2), order(3, { onHold })],
      ),
    );

    const row = rowOf("ショップ3");
    if (onHold) {
      await expect
        .element(row.getByText("保留中の見込み 300P", { exact: true }))
        .toBeInTheDocument();
    } else {
      await expect.element(row.getByText("3倍", { exact: true })).toBeVisible();
      await expect.element(row).toMatchTextContent("300P");
    }
  });
}

test("fits 977px, the narrowest it is shown at, without horizontal scroll", async () => {
  await page.viewport(977, 900);
  const long = "とても長い名前のショップ".repeat(6);
  const wideShops = shops.map((shop, index) => (index === 0 ? { ...shop, name: long } : shop));
  const wide = order(0);
  wide.lineItems = wide.lineItems.map((item) => ({ ...item, name: "長い商品名".repeat(20) }));
  const screen = await renderWith(
    makePlan([baseBenefit, spuBenefit, campaignBenefit, ...marathon], [wide, order(1)]),
    wideShops,
  );

  await expect.element(rows()).toHaveLength(2);
  // Measured while the page is short enough to be on screen. The handle is drawn narrow and pressed in a 44px square around it: points 21px out hit it.
  const handle = screen.getByRole("button", { name: `${long}の注文を並べ替え` }).element();
  const box = handle.getBoundingClientRect();
  const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
  for (const [dx, dy] of [
    [-21, 0],
    [21, 0],
    [0, -21],
    [0, 21],
  ] as const) {
    expect(document.elementFromPoint(x + dx, y + dy)?.closest("button"), `${dx},${dy}`).toBe(
      handle,
    );
  }
  // The new order's conditions are the fields measured; a new shop's name is in the shop field.
  await openNewOrder(screen);
  await enterShop(screen, "はじめての店");

  // Every control can be pressed in at least 44px both ways (the switch through its label), even
  // one drawn smaller. The area is read by hit-testing: no matcher measures it.
  const controls = [
    screen
      .getByRole("switch", { name: `${long}の注文を購入決定` })
      .element()
      .closest("label"),
    ...Array.from(
      list().element().querySelectorAll("input:not([type=checkbox]), select, button, summary"),
      // A date picker's box, a tax rate's label over its hidden radio, and the column around an
      // input of the add row are what is tapped.
      (control) =>
        control.closest(DATE_PICKER_FIELD) ??
        (control.matches("[type=radio]") ? control.closest("label") : null) ??
        control.closest("[data-press-area]") ??
        control,
    ).filter(
      // The rate's up and down buttons share the field's height; the rate is typed in the field,
      // which is pressed in full.
      (control) =>
        !control.closest(".ui-number-input__control") && (control as Element).checkVisibility(),
    ),
  ];
  for (const control of controls) {
    const { width, height } = tapArea(control as Element);
    // Rounded, as layout can leave a 44px control a hair under 44.
    expect(
      Math.round(Math.min(width, height)),
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

test("the add row becomes an order by ⌘ + Enter in its amount, and moves on to the next one", async () => {
  // The new order is dated today, so today is in the plan's period (10/4 to 10/9) for it to count.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T03:00:00Z"));
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);

  // 「＋ 注文を追加」 puts the caret in the name; Enter goes on to the amount.
  await screen.getByText("＋ 注文を追加").click();
  await expect.element(newName()).toHaveFocus();
  await userEvent.keyboard("フェイスタオル{Enter}");
  await expect.element(newAmount()).toHaveFocus();
  await userEvent.keyboard("11,000");
  // Enter alone does not make it.
  await userEvent.keyboard("{Enter}");
  expect((await stored())?.length).toBe(1);
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  expect((await stored())?.[1]).toMatchObject({
    date: "2026-10-05",
    onHold: false,
    tags: [],
    lineItems: [{ name: "フェイスタオル", unitPrice: 11000, quantity: 1, taxRate: 0.1 }],
  });
  await expect.element(rows()).toHaveLength(2);
  await expect.element(newName()).toHaveFocus();
  await expect.element(newName()).toHaveValue("");
  await expect.element(newAmount()).toHaveValue("");
});

test("a name alone makes no order", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);

  await newName().fill("あとで決める");
  await userEvent.keyboard("{Tab}{Tab}{Tab}");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect((await stored())?.length).toBe(1);
  await expect.element(newName()).toHaveValue("あとで決める");
  await expect.element(screen.getByRole("button", { name: "新しい注文の条件" })).toBeVisible();
});

test("leaving the amount for the row's name makes the order and edits its name at the end", async () => {
  await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);

  await newName().fill("タオル");
  await newAmount().fill("1,000");
  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  const name = page.getByRole("textbox", { name: "ショップ未入力の注文の商品名" });
  await expect.element(name).toHaveFocus();
  await expect.element(name).toHaveValue("タオル");
  const input = name.element() as HTMLInputElement;
  expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
  await expect.element(newName()).toHaveValue("");

  await userEvent.keyboard("ケット{Enter}");
  await expect.poll(async () => (await stored())?.[1]?.lineItems[0]?.name).toBe("タオルケット");
});

test("Tab from the add row's amount to its ⌄ makes the order and opens it", async () => {
  await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);

  await newAmount().fill("2,200");
  await userEvent.keyboard("{Tab}");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  const toggle = page.getByRole("button", { name: "ショップ未入力の注文の詳細と編集" });
  await expect.element(toggle).toHaveFocus();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect
    .element(page.getByRole("button", { name: "新しい注文の条件" }))
    .toHaveAttribute("aria-expanded", "false");
});

test("conditions opened before the order is made stay open on it, but not after ⌘ + Enter", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);

  await openNewOrder(screen);
  await enterShop(newOrderRow(), "ショップ4");
  await newAmount().fill("3,300");
  // Leaving the amount for anywhere outside the row makes the order there.
  await heading().click();
  await expect.poll(async () => (await stored())?.length).toBe(2);
  expect((await stored())?.[1]?.shopId).toBe(shopId(4));
  await expect
    .element(screen.getByRole("button", { name: "ショップ4の注文の詳細と編集" }))
    .toHaveAttribute("aria-expanded", "true");

  await openNewOrder(screen);
  await enterShop(newOrderRow(), "ショップ5");
  await newAmount().fill("4,400");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  await expect.poll(async () => (await stored())?.length).toBe(3);
  await expect
    .element(screen.getByRole("button", { name: "ショップ5の注文の詳細と編集" }))
    .toHaveAttribute("aria-expanded", "false");
  await expect.element(newName()).toHaveFocus();
});

test("an invalid amount shows its error and saves nothing", async () => {
  await renderWith(marathonPlan([order(0)]));
  await expect.element(rows()).toHaveLength(1);

  await newAmount().fill("abc");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect.element(page.getByText("金額は0以上の整数で入れてください")).toBeVisible();
  await expect.element(newAmount()).toHaveAttribute("aria-invalid", "true");
  await expect.element(newAmount()).toHaveFocus();
  await expect.element(newAmount()).toHaveValue("abc");
  expect((await stored())?.length).toBe(1);
});

test("an error under one field leaves the other fields of its row in place", async () => {
  const screen = await renderWith(marathonPlan([order(0)]));
  await expect.element(rows()).toHaveLength(1);
  await openNewOrder(screen);
  // Its error takes two lines, the tallest under the new order's fields.
  await newOrderRow()
    .getByRole("spinbutton", { name: /^独自倍率/ })
    .fill("0.5");
  await newAmount().fill("1,000");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  await expect
    .element(screen.getByText("ショップ独自倍率は1以上の数で入れてください"))
    .toBeVisible();
  expect((await stored())?.length).toBe(1);

  // Positions are read from the elements: no matcher measures them.
  expect(misalignedFields(newOrderRow().element())).toEqual([]);
});

test("a failed save keeps the add row's input", async () => {
  await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.element(rows()).toHaveLength(1);
  repository().plans.update = async () => {
    throw new Error("disk full");
  };

  await newAmount().fill("3300");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect
    .element(page.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();
  await expect.element(newAmount()).toHaveValue("3300");
  expect((await stored())?.length).toBe(1);
});

test("a URL pasted into the add row's name picks the shop and opens its conditions", async () => {
  const withCodes = shops.map((shop, index) =>
    index === 4 ? { ...shop, shopCode: "shop-four", tags: ["39shop" as const] } : shop,
  );
  const screen = await renderWith(marathonPlan([]), withCodes);

  // A paste of the URL, as from the clipboard.
  const data = new DataTransfer();
  data.setData("text/plain", "https://item.rakuten.co.jp/shop-four/item-1/");
  newName()
    .element()
    .dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));

  await expect
    .element(urlField(screen))
    .toHaveValue("https://item.rakuten.co.jp/shop-four/item-1/");
  await expect.element(newName()).toHaveValue("");
  await expect.element(shopField(screen)).toHaveValue("ショップ4");
  await expect.element(screen.getByRole("checkbox", { name: "39ショップ" })).toBeChecked();
});

test("the name and amount are edited on the closed row", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  let saves = 0;
  const update = repository().plans.update.bind(repository().plans);
  repository().plans.update = (id, change, shop) => {
    saves += 1;
    return update(id, change, shop);
  };
  const nameText = () => screen.getByRole("button", { name: /^ショップ0の注文の商品名/ });
  const name = screen.getByRole("textbox", { name: "ショップ0の注文の商品名" });
  const amount = screen.getByRole("textbox", { name: "ショップ0の注文の金額" });

  await nameText().click();
  await expect.element(name).toHaveFocus();
  await userEvent.fill(name, "バスタオル");
  await userEvent.keyboard("{Enter}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[0]?.name).toBe("バスタオル");
  // The focus is back on the text, which is not edited again until Enter.
  await expect.element(nameText()).toHaveFocus();
  await expect.element(name).not.toBeInTheDocument();
  await userEvent.keyboard("{Enter}");
  await expect.element(name).toHaveFocus();
  // Esc puts back what the name had.
  await userEvent.fill(name, "なし");
  await userEvent.keyboard("{Escape}");
  await expect.element(nameText()).toHaveFocus();
  await expect.element(rowOf("ショップ0")).toMatchTextContent("バスタオル");

  // Tab goes on to the amount, which a change that cannot be saved does not leave on Enter.
  await nameText().click();
  await userEvent.keyboard("{Tab}");
  await expect.element(amount).toHaveFocus();
  await userEvent.fill(amount, "abc");
  await userEvent.keyboard("{Enter}");
  await expect.element(amount).toHaveAttribute("aria-invalid", "true");
  await expect.element(amount).toHaveFocus();
  expect((await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(11000);
  await userEvent.fill(amount, "22,000");
  await userEvent.keyboard("{Enter}");
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥22,000");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(saves).toBe(2);
  expect((await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(22000);
});

test("a change left in a row that cannot be saved is put back", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await screen.getByRole("button", { name: /^ショップ0の注文の金額/ }).click();
  const amount = screen.getByRole("textbox", { name: "ショップ0の注文の金額" });
  await userEvent.fill(amount, "abc");
  await heading().click();

  await expect.element(amount).not.toBeInTheDocument();
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥11,000");
  await screen.getByRole("button", { name: /^ショップ0の注文の金額/ }).click();
  await expect.element(amount).toHaveValue("11,000");
  await expect.element(amount).not.toHaveAttribute("aria-invalid");
});

test("Tab from a row's amount to its ⌄ opens the row", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0), order(1)]));
  let saves = 0;
  const update = repository().plans.update.bind(repository().plans);
  repository().plans.update = (id, change, shop) => {
    saves += 1;
    return update(id, change, shop);
  };
  const toggle = screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" });

  await screen.getByRole("button", { name: /^ショップ0の注文の商品名/ }).click();
  await userEvent.keyboard("{Tab}{Tab}");

  await expect.element(toggle).toHaveFocus();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect
    .element(rowOf("ショップ0").getByRole("textbox", { name: /^ショップ/ }))
    .toBeVisible();
  // Nothing was changed, so nothing was saved.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(saves).toBe(0);

  // Reached any other way, the ⌄ only takes the focus.
  const other = screen.getByRole("button", { name: "ショップ1の注文の詳細と編集" });
  other.element().focus();
  await expect.element(other).toHaveAttribute("aria-expanded", "false");
});

test("an edit whose save failed can be saved again", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  const update = repository().plans.update.bind(repository().plans);
  let failNext = true;
  repository().plans.update = (id, change, shop) => {
    if (failNext) {
      failNext = false;
      return Promise.reject(new Error("disk full"));
    }
    return update(id, change, shop);
  };

  await screen.getByRole("button", { name: /^ショップ0の注文の金額/ }).click();
  const amount = screen.getByRole("textbox", { name: "ショップ0の注文の金額" });
  await userEvent.fill(amount, "22,000");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByText("変更を保存できませんでした。もう一度お試しください。"))
    .toBeVisible();
  // Still in the input, to be saved again.
  await expect.element(amount).toHaveValue("22,000");
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥11,000");

  await userEvent.keyboard("{Enter}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(22000);
  await expect.element(rowOf("ショップ0")).toMatchTextContent("¥22,000");
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
  await userEvent.dragAndDrop(
    screen.getByRole("button", { name: "ショップ0の注文を並べ替え" }),
    screen.getByRole("button", { name: "ショップ2の注文の詳細と編集" }),
  );

  await expectShopsInOrder(rows(), ["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect
    .poll(async () => (await stored())?.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(2), shopId(0), shopId(3)]);
  await expect
    .element(screen.getByText("ショップ0の注文を3番目に移動しました"))
    .toBeInTheDocument();
});

test("dragging an order up closes the opened one", async () => {
  const screen = await renderWith();
  const opened = screen.getByRole("button", { name: "ショップ1の注文の詳細と編集" });
  await opened.click();
  await expect.element(opened).toHaveAttribute("aria-expanded", "true");

  await userEvent.dragAndDrop(
    screen.getByRole("button", { name: "ショップ3の注文を並べ替え" }),
    screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }),
  );

  await expect.element(opened).toHaveAttribute("aria-expanded", "false");
  await expectShopsInOrder(rows(), ["ショップ3", "ショップ0", "ショップ1", "ショップ2"]);
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

test("expanded row shows group totals and edits the order's conditions", async () => {
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
  // The name and amount are on the row only.
  await expect.element(row.getByRole("textbox", { name: /金額/ })).not.toBeInTheDocument();

  // The conditions are there at once, with no 「条件」 to open.
  await row.getByRole("group", { name: "税率" }).getByText("8%（食品）", { exact: true }).click();
  await row.getByLabelText("注文日").fill("2026/10/07");
  await row.getByRole("spinbutton", { name: /^独自倍率/ }).fill("3");
  await userEvent.keyboard("{Enter}");
  await tapCard(row.getByRole("checkbox", { name: "リピート購入" }));
  await expect.element(row.getByRole("checkbox", { name: "リピート購入" })).toBeChecked();

  await expect
    .poll(async () => (await stored())?.[0])
    .toMatchObject({
      date: "2026-10-07",
      tags: ["repeat"],
      lineItems: [{ unitPrice: 11000, taxRate: 0.08, shopPointRate: 3 }],
    });

  const shopTag = row.getByRole("checkbox", { name: "39ショップ" });
  await expect
    .element(shopTag)
    .toHaveAccessibleDescription("このショップの注文すべてに反映されます");
  await tapCard(shopTag);
  await expect
    .poll(async () => (await repository().shops.list()).find((s) => s.id === shopId(0))?.tags)
    .toEqual(["39shop"]);

  await enterShop(row, "ショップ5");
  await expect.poll(async () => (await stored())?.[0]?.shopId).toBe(shopId(5));

  // 複製 and 削除 work from the expanded row.
  await screen.getByRole("button", { name: "複製" }).click();
  await expect.element(rows()).toHaveLength(5);
  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.element(rows()).toHaveLength(4);
});

test("an opened row puts its order at a new shop", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();

  await enterShop(rowOf("ショップ0"), "はじめての店");
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

test("the new order's conditions and an opened row take turns, and the add row keeps what was typed", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  const add = screen.getByRole("button", { name: "新しい注文の条件" });
  const row = screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" });

  await add.click();
  await newName().fill("あとで足す");
  await row.click();
  await expect.element(row).toHaveAttribute("aria-expanded", "true");
  await expect.element(add).toHaveAttribute("aria-expanded", "false");

  await add.click();
  await expect.element(row).toHaveAttribute("aria-expanded", "false");
  await expect.element(newName()).toHaveValue("あとで足す");
});

test("the add row makes an order with a quantity, a coupon and a second item", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));

  await openNewOrder(screen);
  const conditions = newOrderRow();
  await conditions.getByRole("textbox", { name: "数量" }).fill("3");
  await conditions.getByRole("textbox", { name: "クーポン値引額（税込）" }).fill("200");
  await conditions.getByRole("button", { name: "＋ 同じショップの商品を追加" }).click();
  const second = conditions.getByRole("group", { name: "商品2" });
  await second.getByRole("textbox", { name: "商品名" }).fill("バスタオル");
  await second.getByRole("textbox", { name: "金額（税込）" }).fill("2,000");
  await newName().fill("フェイスタオル");
  await newAmount().fill("1,000");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  expect((await stored())?.[1]?.lineItems).toMatchObject([
    { name: "フェイスタオル", unitPrice: 1000, quantity: 3, discount: 200 },
    { name: "バスタオル", unitPrice: 2000, quantity: 1 },
  ]);
});

test("an order of several items edits its amounts in its opened row", async () => {
  const several = order(0, { items: 2 });
  const screen = await renderWith(marathonPlan([several, order(1)]));

  // Its amount on the row is the sum of its items: pressed, it opens the first item's amount.
  await screen.getByRole("button", { name: /^ショップ0の注文の金額 ¥22,000/ }).click();
  const row = rowOf("ショップ0");
  const first = row.getByRole("textbox", { name: "商品1の金額（税込）" });
  await expect.element(first).toHaveFocus();
  await userEvent.fill(first, "5,500");
  await userEvent.keyboard("{Enter}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(5500);

  const second = row.getByRole("group", { name: "商品2" });
  await second.getByRole("textbox", { name: "数量" }).fill("4");
  await userEvent.keyboard("{Tab}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[1]?.quantity).toBe(4);

  await second.getByRole("button", { name: "商品2を削除" }).click();
  await expect.poll(async () => (await stored())?.[0]?.lineItems).toHaveLength(1);
});

test("an opened row of a plan with brand day saves the order's brand day tag", async () => {
  const screen = await renderWith(
    makePlan(
      [
        baseBenefit,
        {
          ...baseBenefit,
          kind: "spend-tiers",
          id: "b0000000-0000-4000-8000-000000000011",
          category: "campaign",
          label: "ブランドデー",
          conditions: { orderTags: ["brand-day"] },
          params: { tiers: [{ minAmount: 0, rate: 2 }], cap: 4000, roundingUnit: "item" },
        },
      ],
      [order(0), order(1)],
    ),
  );

  await screen.getByRole("button", { name: "ショップ0の注文の詳細と編集" }).click();
  await tapCard(rowOf("ショップ0").getByRole("checkbox", { name: "ブランドデー対象" }));
  await expect.poll(async () => (await stored())?.[0]?.tags).toEqual(["brand-day"]);
});

test("editing one order does not re-render the other rows", async () => {
  await cleanup();
  const plan = makePlan([baseBenefit, spuBenefit, campaignBenefit], [order(0), order(1)]);
  const memory = createMemoryRepository({ shops, plans: [plan] });
  let updateOrder: ((order: Order) => Promise<unknown>) | undefined;

  function Loaded() {
    const plans = useAtomValue(plansQueryAtom);
    const loadedShops = useAtomValue(shopsQueryAtom);
    const update = useSetAtom(updateOrderAtom);
    useEffect(() => {
      updateOrder = (next) => update({ planId: PLAN, order: next });
    }, [update]);
    const loaded = plans.data?.find((p) => p.id === PLAN);
    return loadedShops.isSuccess && loaded ? <OrderTable plan={loaded} head={null} /> : null;
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
