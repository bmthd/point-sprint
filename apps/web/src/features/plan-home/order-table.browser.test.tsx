import type { Order } from "@workspaces/domain";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { updateOrderAtom } from "../../state/order-ops";
import { plansQueryAtom, shopsQueryAtom } from "../../state/queries";
import { createMemoryRepository } from "../../storage/memory-repository";
import { misalignedFields } from "../../test-layout";
import { tokyoToday } from "../../ui/dates";
import { OrderTable } from "./order-table";
import {
  PLAN,
  Providers,
  baseBenefit,
  campaignBenefit,
  makePlan,
  marathon,
  marathonPlan,
  order,
  orderId,
  renderPlanHome,
  shopId,
  shops,
  spuBenefit,
  summaryText,
} from "./test-fixtures";

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

const list = () => document.querySelector<HTMLElement>("ol[aria-labelledby]");
const rows = () => Array.from(list()?.querySelectorAll<HTMLElement>("li[data-order-id]") ?? []);
const rowOf = (shop: string) => rows().find((row) => row.textContent?.includes(shop));
const shopsInOrder = () => rows().map((row) => row.textContent?.match(/ショップ\d/)?.[0]);
const heading = () => document.querySelector('section[aria-label="注文のリスト"] h2')?.textContent;
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
  if (toggle.element().getAttribute("aria-expanded") === "false") await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
}

test("the list replaces the cards from 1024px", async () => {
  await renderWith();
  await expect.poll(() => rows().length).toBe(4);
  expect(document.querySelector('ul[aria-label="注文"]')).toBeNull();
  expect(document.querySelector("table")?.closest("#orders")).toBeFalsy();
  expect(document.body.textContent).toContain(
    "表示は目安です。実際の付与ポイントとは誤差が出ることがあります。",
  );

  await page.viewport(1000, 900);
  await expect.poll(() => document.querySelector('ul[aria-label="注文"]')).not.toBeNull();
  expect(list()).toBeNull();
});

test("each row shows the order's shop, items, amount, points and rate", async () => {
  await renderWith(
    makePlan(
      [baseBenefit, spuBenefit, campaignBenefit, ...marathon],
      [order(0, { items: 2 }), order(1), order(2), order(3)],
    ),
  );

  await expect.poll(() => rows().length).toBe(4);
  const row = rowOf("ショップ0");
  // ¥20,000 before tax at 通常 1 + SPU 2 + campaign 1 + marathon 3 = 7倍 is 1,400P.
  expect(row?.querySelector('[data-badge="order"]')?.textContent).toBe("1");
  for (const text of [
    "10/5（月）",
    "商品0-1 他1点",
    "0と5のつく日",
    "¥22,000",
    "10%",
    "1,400P",
    "7倍",
  ]) {
    expect(row?.textContent).toContain(text);
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

  await expect.poll(() => rows().length).toBe(2);
  await screen.getByRole("button", { name: `${long}の注文の詳細と編集` }).click();
  await openAddForm(screen);
  // The add form comes after the open row, so its shop field is the last one.
  await screen
    .getByRole("combobox", { name: "ショップ" })
    .last()
    .selectOptions("＋ 新しいショップ");

  // Every control is at least 44px both ways (the checkbox through its label).
  const controls = [
    screen.getByRole("button", { name: `${long}の注文を並べ替え` }).element(),
    screen
      .getByRole("checkbox", { name: `${long}の注文を買い回りにカウント` })
      .element()
      .closest("label"),
    screen.getByRole("button", { name: `${long}の注文の詳細と編集` }).element(),
    ...Array.from(list()?.querySelectorAll("input:not([type=checkbox]), select, button") ?? []),
  ];
  for (const control of controls) {
    const { width, height } = (control as HTMLElement).getBoundingClientRect();
    expect(
      Math.min(width, height),
      (control as HTMLElement).outerHTML.slice(0, 80),
    ).toBeGreaterThanOrEqual(44);
  }

  const element = list() as HTMLElement;
  expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
  for (const row of rows()) expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
});

test("enter in the add form adds an order and refocuses the first field", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));

  await expect.poll(() => rows().length).toBe(1);
  await openAddForm(screen);
  const url = screen.getByRole("textbox", { name: "商品のURL（貼るとショップを選びます）" });
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "ショップ" }), "ショップ4");
  await screen.getByRole("textbox", { name: "商品名メモ" }).fill("フェイスタオル");
  await screen.getByRole("textbox", { name: "金額（税込）" }).fill("11,000");
  // ¥10,000 before tax at 通常 1倍, at a second shop.
  await expect
    .poll(() => document.querySelector("[data-preview]")?.textContent)
    .toBe("この注文で（2店舗目） 約 +100P");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "税率" }), "8%");
  await screen.getByRole("textbox", { name: "金額（税込）" }).click();
  await userEvent.keyboard("{Enter}");

  await expect.poll(shopsInOrder).toEqual(["ショップ0", "ショップ4"]);
  expect(rowOf("ショップ4")?.textContent).toContain("¥11,000");
  await expect.poll(() => document.activeElement).toBe(url.element());
  await expect
    .element(screen.getByRole("button", { name: /注文を追加/ }))
    .toHaveAttribute("aria-expanded", "true");
  await expect.element(screen.getByRole("combobox", { name: "ショップ" })).toHaveValue("");
  await expect.element(screen.getByRole("textbox", { name: "商品名メモ" })).toHaveValue("");
  await expect.element(screen.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("");

  await expect.poll(async () => (await stored())?.length).toBe(2);
  expect((await stored())?.[1]).toMatchObject({
    shopId: shopId(4),
    date: tokyoToday(new Date()),
    onHold: false,
    tags: [],
    lineItems: [{ name: "フェイスタオル", unitPrice: 11000, quantity: 1, taxRate: 0.08 }],
  });
});

test("an invalid add form shows errors and saves nothing", async () => {
  const screen = await renderWith(marathonPlan([order(0)]));

  await expect.poll(() => rows().length).toBe(1);
  await openAddForm(screen);
  const amount = screen.getByRole("textbox", { name: "金額（税込）" });
  await amount.fill("abc");
  await userEvent.keyboard("{Enter}");

  await expect.element(screen.getByText("ショップを選んでください")).toBeVisible();
  await expect.element(screen.getByText("金額は0以上の整数で入れてください")).toBeVisible();
  await expect.element(amount).toHaveAttribute("aria-invalid", "true");
  // The first field with an error takes the focus.
  await expect.element(screen.getByRole("combobox", { name: "ショップ" })).toHaveFocus();
  await expect.element(amount).toHaveValue("abc");
  expect(rows().length).toBe(1);
  expect((await stored())?.length).toBe(1);
});

test("an error under one field leaves the other fields of its row in place", async () => {
  const screen = await renderWith(marathonPlan([order(0)]));
  await expect.poll(() => rows().length).toBe(1);
  await openAddForm(screen);
  // Its error takes two lines, the tallest under the add form's fields.
  await screen.getByRole("textbox", { name: "ショップ独自倍率" }).fill("0.5");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByText("ショップ独自倍率は1以上の数で入れてください"))
    .toBeVisible();

  const form = list()?.querySelector("form");
  if (!form) throw new Error("no add form");
  expect(misalignedFields(form)).toEqual([]);
});

test("a failed save keeps the add form's input", async () => {
  const screen = await renderWith(makePlan([baseBenefit], [order(0)]));
  await expect.poll(() => rows().length).toBe(1);
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
  await expect.poll(() => rows().length).toBe(1);
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
  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("¥11,000");

  await amount().fill("22,000");
  await userEvent.keyboard("{Enter}");
  await expect.poll(async () => (await stored())?.[0]?.lineItems[0]?.unitPrice).toBe(22000);
  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("¥22,000");
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
  await expect
    .element(screen.getByRole("button", { name: "39ショップ" }))
    .toHaveAttribute("aria-pressed", "true");

  await url.fill("https://item.rakuten.co.jp/coffee-beans/item-2/");
  await expect.element(shop).toHaveValue("new");
  const name = screen.getByRole("textbox", { name: "新しいショップの名前" });
  await expect.element(name).toHaveValue("coffee-beans");
  await name.fill("コーヒー豆の店");
  await screen.getByRole("button", { name: "リピート購入" }).click();
  await screen.getByRole("textbox", { name: "金額（税込）" }).fill("2160");
  await screen.getByRole("button", { name: "追加する" }).click();

  await expect.poll(() => rows()[0]?.textContent).toContain("コーヒー豆の店");
  const saved = (await repository().shops.list()).find((s) => s.name === "コーヒー豆の店");
  expect(saved).toMatchObject({ channel: "rakuten-ichiba", shopCode: "coffee-beans", tags: [] });
  await expect.poll(async () => (await stored())?.[0]?.shopId).toBe(saved?.id);
  expect((await stored())?.[0]?.tags).toEqual(["repeat"]);
});

test("keyboard reorder with the handle", async () => {
  const screen = await renderWith();

  await expect.poll(() => rows().length).toBe(4);
  const handle = screen.getByRole("button", { name: "ショップ0の注文を並べ替え" });
  handle.element().focus();
  await userEvent.keyboard("{ArrowDown}");

  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
  await expect.poll(() => document.activeElement).toBe(handle.element());
  await expect
    .element(screen.getByText("ショップ0の注文を2番目に移動しました"))
    .toBeInTheDocument();

  await userEvent.keyboard("{ArrowDown}");
  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect.poll(() => document.activeElement).toBe(handle.element());

  await userEvent.keyboard("{ArrowUp}");
  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
  await expect
    .poll(async () => (await stored())?.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(0), shopId(2), shopId(3)]);

  // The first order cannot go further up.
  screen.getByRole("button", { name: "ショップ1の注文を並べ替え" }).element().focus();
  await userEvent.keyboard("{ArrowUp}");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(shopsInOrder()).toEqual(["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);
});

test("drag the handle onto another row to reorder", async () => {
  const screen = await renderWith();

  await expect.poll(() => rows().length).toBe(4);
  const events: string[] = [];
  for (const type of ["pointercancel", "dragstart", "drop", "dragend"]) {
    list()?.addEventListener(type, () => events.push(type));
  }
  await userEvent.dragAndDrop(
    screen.getByRole("button", { name: "ショップ0の注文を並べ替え" }),
    screen.getByRole("button", { name: "ショップ2の注文の詳細と編集" }),
  );

  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect
    .poll(async () => (await stored())?.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(2), shopId(0), shopId(3)]);
  // The move went through the browser's own drag and drop, started from the handle.
  expect(events).toContain("dragstart");
  expect(events).toContain("drop");
  expect(events.at(-1)).toBe("dragend");
});

test("count checkbox toggles hold", async () => {
  const screen = await renderWith();

  await expect.poll(summaryText).toContain("4店舗を買い回り中");
  const counted = screen.getByRole("checkbox", { name: "ショップ1の注文を買い回りにカウント" });
  await expect.element(counted).toBeChecked();
  // The input itself is visually hidden; a click lands on the box drawn in its label.
  await userEvent.click(counted.element().closest("label") as HTMLElement);

  await expect.element(counted).not.toBeChecked();
  await expect.poll(summaryText).toContain("3店舗を買い回り中");
  await expect.poll(heading).toBe("注文 4件（保留 1）");
  expect(rowOf("ショップ1")?.querySelector('[data-badge="order"]')?.textContent).toBe("保留");
  expect(rowOf("ショップ2")?.querySelector('[data-badge="order"]')?.textContent).toBe("2");
  // Counting it again adds 通常 100 + SPU 200, and the marathon goes from +2倍 on three shops to
  // +3倍 on four: 900P in all.
  expect(rowOf("ショップ1")?.querySelector("s")?.textContent).toContain("900P");
  await expect.poll(async () => (await stored())?.[1]?.onHold).toBe(true);

  // With the keyboard: Space on the focused checkbox counts it again.
  counted.element().focus();
  await userEvent.keyboard(" ");
  await expect.poll(summaryText).toContain("4店舗を買い回り中");
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

  const panel = () =>
    document.getElementById(details.element().getAttribute("aria-controls") ?? "");
  const legend = Array.from(panel()?.querySelectorAll("li") ?? []).map((item) => item.textContent);
  // ¥10,000 before tax: 通常 1倍, SPU 2倍, マラソン 3倍, 0と5のつく日 1倍.
  expect(legend).toEqual(["通常100P", "SPU200P", "マラソン300P", "キャンペーン100P"]);
  expect(panel()?.textContent).toContain("税抜の基準額 ¥10,000");

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
  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("¥22,000");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(saves).toBe(1);
  await screen.getByRole("textbox", { name: "商品名メモ" }).fill("バスタオル");
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("バスタオル");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "税率" }), "8%");
  // The closed add form's date field is the second one.
  await screen.getByLabelText("注文日").first().fill("2026-10-07");
  await screen.getByRole("textbox", { name: "ショップ独自倍率" }).fill("3");
  await userEvent.keyboard("{Enter}");
  await screen.getByRole("button", { name: "リピート購入" }).click();
  await expect
    .element(screen.getByRole("button", { name: "リピート購入" }))
    .toHaveAttribute("aria-pressed", "true");

  await expect
    .poll(async () => (await stored())?.[0])
    .toMatchObject({
      date: "2026-10-07",
      tags: ["repeat"],
      lineItems: [{ name: "バスタオル", unitPrice: 22000, taxRate: 0.08, shopPointRate: 3 }],
    });

  const shopTag = screen.getByRole("button", { name: "39ショップ" });
  await expect
    .element(shopTag)
    .toHaveAccessibleDescription("このショップの注文すべてに反映されます");
  await shopTag.click();
  await expect
    .poll(async () => (await repository().shops.list()).find((s) => s.id === shopId(0))?.tags)
    .toEqual(["39shop"]);

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "ショップ" }), "ショップ5");
  await expect.poll(async () => (await stored())?.[0]?.shopId).toBe(shopId(5));

  // コピー and 削除 work from the expanded row.
  await screen.getByRole("button", { name: "コピー" }).click();
  await expect.poll(() => rows().length).toBe(5);
  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(() => rows().length).toBe(4);
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
  expect(panel.getByRole("combobox", { name: "税率" }).query()).toBeNull();
  expect(panel.getByRole("textbox", { name: "ショップ独自倍率" }).query()).toBeNull();
  expect(panel.getByText("商品ごとに異なります").elements()).toHaveLength(2);

  // A change to the order's own fields leaves each item's rates as they were.
  await screen.getByRole("button", { name: "リピート購入" }).click();
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

  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("400P");
  await expect.poll(() => rowOf("ショップ1")?.textContent).toContain("400P");
  const before = rowRenders.get(orderId(1));

  const edited = order(0);
  edited.lineItems = edited.lineItems.map((item) => ({ ...item, unitPrice: 22000 }));
  await updateOrder?.(edited);

  await expect.poll(() => rowOf("ショップ0")?.textContent).toContain("800P");
  // Wait for the refetch that follows the save to settle as well.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(rowRenders.get(orderId(0))).toBeGreaterThan(1);
  expect(rowRenders.get(orderId(1))).toBe(before);
  expect(screen.container.textContent).toContain("¥22,000");
});
