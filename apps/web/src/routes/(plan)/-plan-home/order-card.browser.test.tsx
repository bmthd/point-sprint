import {
  BOOKS_SPU_ID,
  DEFAULT_ACCOUNT_ID,
  type Order,
  spuIdsIn,
  spuMonthId,
} from "@workspaces/domain";
import { List } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { Profiler, type ReactNode, useEffect } from "react";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { updateOrderAtom } from "../../../state/order-ops";
import { plansQueryAtom, shopsQueryAtom } from "../../../state/queries";
import { createMemoryRepository } from "../../../storage/memory-repository";
import { expectTexts } from "../../../test-texts";
import { OrderCard } from "./order-card";
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
} from "../-test-fixtures";

const list = () => page.getByRole("list", { name: "注文", exact: true });
// The open card also lists its items, which do not hold a shop's name.
const cards = () =>
  list()
    .getByRole("listitem")
    .filter({ hasText: /ショップ\d/ });
const cardOf = (shop: string) => list().getByRole("listitem").filter({ hasText: shop });
// The card's header, which opens it, is its first button.
const toggleOf = (shop: string) => cardOf(shop).getByRole("button").first();
const heading = () =>
  page.getByRole("region", { name: "注文のリスト" }).getByRole("heading", { level: 2 });

test("shows each order's shop, items, amount, campaign badges and rate", async () => {
  const plan = makePlan(
    [baseBenefit, spuBenefit, campaignBenefit, ...marathon],
    [order(0, { items: 2 }), order(1), order(2), order(3)],
  );
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.element(heading()).toHaveTextContent("注文 4件");
  const first = cardOf("ショップ0");
  // ¥20,000 before tax at 通常 1 + SPU 2 + campaign 1 + marathon 3 = 7倍 is 1,400P.
  for (const text of [
    "10/5（月）",
    "商品0-1 他1点",
    "¥22,000",
    "10%",
    "0と5のつく日",
    "1,400P",
    "7倍",
  ]) {
    await expect.element(first).toMatchTextContent(text);
  }
  await expect.element(first.getByText("1", { exact: true })).toBeVisible();

  await toggleOf("ショップ0").click();
  await expect.element(toggleOf("ショップ0")).toHaveAttribute("aria-expanded", "true");
  await expect.element(first).toMatchTextContent("税抜の基準額¥20,000");
  await expectTexts(first.getByRole("list", { name: "ポイントの内訳" }).getByRole("listitem"), [
    "通常1倍200P",
    "SPU+2倍400P",
    "マラソン+3倍600P",
    "0と5のつく日+1倍200P",
  ]);
});

for (const onHold of [false, true]) {
  test(`fully capped ${onHold ? "held" : "counted"} card omits the marathon contribution`, async () => {
    const capped = structuredClone(marathon);
    for (const benefit of capped) benefit.params.cap = 0;
    const plan = makePlan(
      [baseBenefit, spuBenefit, ...capped],
      [order(0), order(1), order(2), order(3, { onHold })],
    );
    await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

    const card = cardOf("ショップ3");
    if (onHold) {
      await expect
        .element(card.getByText("保留中の見込み 300P", { exact: true }))
        .toBeInTheDocument();
    } else {
      await expect.element(card.getByText("3倍", { exact: true })).toBeVisible();
    }
    await toggleOf("ショップ3").click();
    await expectTexts(
      card
        .getByRole("list", {
          name: onHold ? "購入決定にしたときの内訳" : "ポイントの内訳",
        })
        .getByRole("listitem"),
      ["通常1倍100P", "SPU+2倍200P"],
    );
  });
}

test("only one card is open at a time", async () => {
  await renderPlanHome(createMemoryRepository({ shops, plans: [marathonPlan()] }));

  await expect.element(cards()).toHaveLength(4);
  await toggleOf("ショップ0").click();
  await expect.element(toggleOf("ショップ0")).toHaveAttribute("aria-expanded", "true");
  await expect.element(toggleOf("ショップ1")).toHaveAttribute("aria-expanded", "false");

  await toggleOf("ショップ1").click();
  await expect.element(toggleOf("ショップ1")).toHaveAttribute("aria-expanded", "true");
  await expect.element(toggleOf("ショップ0")).toHaveAttribute("aria-expanded", "false");
  await expect.element(cardOf("ショップ0")).not.toMatchTextContent("税抜の基準額");

  await toggleOf("ショップ1").click();
  await expect.element(toggleOf("ショップ1")).toHaveAttribute("aria-expanded", "false");
});

test("hold toggle moves the order out of the shop count", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.element(summary()).toMatchTextContent("4店舗を買い回り中");
  await toggleOf("ショップ1").click();
  const counted = screen.getByRole("switch", { name: "購入決定（オフで保留）" });
  // The switch's input sits under its track, so it is clicked through its label.
  const label = screen.getByText("購入決定（オフで保留）");
  await expect.element(counted).toBeChecked();
  await label.click();

  await expect.element(summary()).toMatchTextContent("3店舗を買い回り中");
  await expect.element(heading()).toHaveTextContent("注文 4件（保留 1）");
  await expect.element(cardOf("ショップ1").getByText("保留", { exact: true })).toBeVisible();
  await expect.element(cardOf("ショップ2").getByText("2", { exact: true })).toBeVisible();
  await expect.element(counted).not.toBeChecked();
  await expect.poll(async () => (await repository.plans.get(PLAN))?.orders[1]?.onHold).toBe(true);

  await label.click();
  await expect.element(summary()).toMatchTextContent("4店舗を買い回り中");
});

test("held card shows the points it would get once counted", async () => {
  const plan = marathonPlan([order(0), order(1), order(2), order(3, { onHold: true })]);
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.element(heading()).toHaveTextContent("注文 4件（保留 1）");
  const held = cardOf("ショップ3");
  // Counted, it gets 通常 100 + SPU 200 + the marathon at +3倍 on four shops (300): 600P. The 300P
  // the other orders gain from the fourth shop are theirs, not this order's.
  await expect.element(held.getByText("保留中の見込み 600P", { exact: true })).toBeInTheDocument();
  await expect.element(held.getByText("保留", { exact: true })).toBeVisible();
});

test("copy adds the order right after", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.element(cards()).toHaveLength(4);
  await toggleOf("ショップ1").click();
  await screen.getByRole("button", { name: "複製" }).click();

  await expectShopsInOrder(cards(), [
    "ショップ0",
    "ショップ1",
    "ショップ1",
    "ショップ2",
    "ショップ3",
  ]);
  await expect.poll(async () => (await repository.plans.get(PLAN))?.orders.length).toBe(5);
});

test("delete asks first, then removes the order", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.element(cards()).toHaveLength(4);
  await toggleOf("ショップ2").click();
  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "キャンセル" }).click();
  await expect.element(cards()).toHaveLength(4);

  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.element(cards()).toHaveLength(3);
  await expect.element(cardOf("ショップ2")).not.toBeInTheDocument();
  await expect.element(summary()).toMatchTextContent("3店舗を買い回り中");
});

test("reset asks first, then removes every order", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.element(cards()).toHaveLength(4);
  await screen.getByRole("button", { name: "リセット" }).click();
  await expect
    .element(screen.getByText("このプランの注文4件がすべて消えます。", { exact: false }))
    .toBeVisible();
  await screen.getByRole("button", { name: "削除する" }).click();

  await expect.element(screen.getByText("まだ注文がありません。", { exact: false })).toBeVisible();
  await expect.poll(async () => (await repository.plans.get(PLAN))?.orders).toEqual([]);
});

test("move up and down in reorder mode", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.element(cards()).toHaveLength(4);
  await expect
    .element(screen.getByRole("button", { name: "ショップ0を上へ" }))
    .not.toBeInTheDocument();
  const reorder = screen.getByRole("button", { name: "並べ替え" });
  await expect.element(reorder).toHaveAttribute("aria-pressed", "false");
  await reorder.click();
  await expect.element(screen.getByRole("button", { name: "完了" })).toBeVisible();

  await expect.element(screen.getByRole("button", { name: "ショップ0を上へ" })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: "ショップ3を下へ" })).toBeDisabled();

  await screen.getByRole("button", { name: "ショップ0を下へ" }).click();
  await expectShopsInOrder(cards(), ["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);

  // With the keyboard: Enter on the focused button moves the order up. Locators have no focus().
  screen.getByRole("button", { name: "ショップ2を上へ" }).element().focus();
  await userEvent.keyboard("{Enter}");
  await expectShopsInOrder(cards(), ["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect
    .poll(async () => (await repository.plans.get(PLAN))?.orders.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(2), shopId(0), shopId(3)]);

  await screen.getByRole("button", { name: "完了" }).click();
  await expect
    .element(screen.getByRole("button", { name: "ショップ0を上へ" }))
    .not.toBeInTheDocument();
});

test("editing one order does not re-render other order cards", async () => {
  await cleanup();
  const plan = makePlan([baseBenefit, spuBenefit, campaignBenefit], [order(0), order(1)]);
  const repository = createMemoryRepository({ shops, plans: [plan] });
  const renders = new Map<string, number>();
  const count = (id: string) => renders.set(id, (renders.get(id) ?? 0) + 1);
  let updateOrder: ((order: Order) => Promise<unknown>) | undefined;

  function Loaded({ children }: { children: ReactNode }) {
    const plans = useAtomValue(plansQueryAtom);
    const loadedShops = useAtomValue(shopsQueryAtom);
    const update = useSetAtom(updateOrderAtom);
    useEffect(() => {
      updateOrder = (next) => update({ planId: PLAN, order: next });
    }, [update]);
    return plans.isSuccess && loadedShops.isSuccess ? children : null;
  }

  const noop = () => {};
  const screen = await render(
    <Providers repository={repository}>
      <Loaded>
        <List.Root aria-label="注文">
          {[0, 1].map((index) => (
            <Profiler key={index} id={`card-${index}`} onRender={count}>
              <OrderCard
                planId={PLAN}
                orderId={orderId(index)}
                badge={index + 1}
                index={index}
                count={2}
                onEdit={noop}
                onDelete={noop}
              />
            </Profiler>
          ))}
        </List.Root>
      </Loaded>
    </Providers>,
  );

  await expect.element(cardOf("ショップ0")).toMatchTextContent("400P");
  await expect.element(cardOf("ショップ1")).toMatchTextContent("400P");
  const before = renders.get("card-1");

  const edited = order(0);
  edited.lineItems = edited.lineItems.map((item) => ({ ...item, unitPrice: 22000 }));
  await updateOrder?.(edited);

  await expect.element(cardOf("ショップ0")).toMatchTextContent("800P");
  // Wait for the refetch that follows the save to settle as well.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(renders.get("card-0")).toBeGreaterThan(1);
  expect(renders.get("card-1")).toBe(before);
  await expect.element(screen.locator).toMatchTextContent("¥22,000");
});

test("holding the only Books order tells that the month's Books SPU may be lost, and turns it off", async () => {
  const withBooks = shops.map((shop, index) =>
    index === 1 ? { ...shop, channel: "rakuten-books" as const } : shop,
  );
  const plan = makePlan([...marathon], [order(0), order(1), order(2), order(3)]);
  const october = {
    id: spuMonthId(DEFAULT_ACCOUNT_ID, "2026-10"),
    accountId: DEFAULT_ACCOUNT_ID,
    month: "2026-10",
    enabledIds: [BOOKS_SPU_ID],
    updatedAt: plan.updatedAt,
  };
  const repository = createMemoryRepository({
    shops: withBooks,
    plans: [plan],
    spuMonths: [october],
  });
  const screen = await renderPlanHome(repository);
  const booksEnabled = async () =>
    spuIdsIn(await repository.spuMonths.list(), DEFAULT_ACCOUNT_ID, "2026-10").has(BOOKS_SPU_ID);

  await expect.element(summary()).toMatchTextContent("4店舗を買い回り中");
  await toggleOf("ショップ1").click();
  await screen.getByText("購入決定（オフで保留）").click();

  await expect
    .element(page.getByText("10月の SPU の楽天ブックスの対象外になるかもしれません"))
    .toBeVisible();
  // The SPU stays on until the user turns it off from the notice.
  expect(await booksEnabled()).toBe(true);
  await page.getByRole("button", { name: "楽天ブックスを OFF にする" }).click();
  await expect.poll(booksEnabled).toBe(false);
  await expect
    .element(page.getByText("10月の SPU の楽天ブックスの対象外になるかもしれません"))
    .not.toBeInTheDocument();
});
