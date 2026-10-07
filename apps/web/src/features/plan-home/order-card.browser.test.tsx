import type { Order } from "@workspaces/domain";
import { useAtomValue, useSetAtom } from "jotai";
import { Profiler, type ReactNode, useEffect } from "react";
import { expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { updateOrderAtom } from "../../state/order-ops";
import { plansQueryAtom, shopsQueryAtom } from "../../state/queries";
import { createMemoryRepository } from "../../storage/memory-repository";
import { OrderCard } from "./order-card";
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

const list = () => document.querySelector<HTMLElement>('ul[aria-label="注文"]');
const cards = () => Array.from(list()?.children ?? []) as HTMLElement[];
const cardOf = (shop: string) => cards().find((card) => card.textContent?.includes(shop));
const toggleOf = (shop: string) =>
  cardOf(shop)?.querySelector<HTMLButtonElement>("button[aria-expanded]");
const heading = () => document.querySelector('section[aria-label="注文のリスト"] h2')?.textContent;

test("shows each order's shop, items, amount, campaign badges and rate", async () => {
  const plan = makePlan(
    [baseBenefit, spuBenefit, campaignBenefit, ...marathon],
    [order(0, { items: 2 }), order(1), order(2), order(3)],
  );
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.poll(heading).toBe("注文 4件");
  const first = cardOf("ショップ0");
  // ¥20,000 before tax at 通常 1 + SPU 2 + campaign 1 + marathon 3 = 7倍 is 1,400P.
  expect(first?.textContent).toContain("10/5（月）");
  expect(first?.textContent).toContain("商品0-1 他1点");
  expect(first?.textContent).toContain("¥22,000");
  expect(first?.textContent).toContain("10%");
  expect(first?.textContent).toContain("0と5のつく日");
  expect(first?.textContent).toContain("1,400P");
  expect(first?.textContent).toContain("7倍");
  expect(first?.querySelector('[data-badge="order"]')?.textContent).toBe("1");

  toggleOf("ショップ0")?.click();
  await expect.poll(() => toggleOf("ショップ0")?.getAttribute("aria-expanded")).toBe("true");
  const details = cardOf("ショップ0")?.textContent ?? "";
  expect(details).toContain("税抜の基準額¥20,000");
  const rows = Array.from(cardOf("ショップ0")?.querySelectorAll('[data-row="benefit"]') ?? []).map(
    (row) => row.textContent,
  );
  expect(rows).toEqual(["通常1倍200P", "SPU+2倍400P", "マラソン+3倍600P", "0と5のつく日+1倍200P"]);
});

test("only one card is open at a time", async () => {
  await renderPlanHome(createMemoryRepository({ shops, plans: [marathonPlan()] }));

  await expect.poll(() => cards().length).toBe(4);
  toggleOf("ショップ0")?.click();
  await expect.poll(() => toggleOf("ショップ0")?.getAttribute("aria-expanded")).toBe("true");
  expect(toggleOf("ショップ1")?.getAttribute("aria-expanded")).toBe("false");

  toggleOf("ショップ1")?.click();
  await expect.poll(() => toggleOf("ショップ1")?.getAttribute("aria-expanded")).toBe("true");
  expect(toggleOf("ショップ0")?.getAttribute("aria-expanded")).toBe("false");
  expect(cardOf("ショップ0")?.textContent).not.toContain("税抜の基準額");

  toggleOf("ショップ1")?.click();
  await expect.poll(() => toggleOf("ショップ1")?.getAttribute("aria-expanded")).toBe("false");
});

test("hold toggle moves the order out of the shop count", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.poll(summaryText).toContain("4店舗を買い回り中");
  toggleOf("ショップ1")?.click();
  const counted = screen.getByRole("switch", { name: "買い回りにカウント（オフで保留）" });
  // The switch's input sits under its track, so it is clicked through its label.
  const label = screen.getByText("買い回りにカウント（オフで保留）");
  await expect.element(counted).toBeChecked();
  await label.click();

  await expect.poll(summaryText).toContain("3店舗を買い回り中");
  await expect.poll(heading).toBe("注文 4件（保留 1）");
  expect(cardOf("ショップ1")?.querySelector('[data-badge="order"]')?.textContent).toBe("保留");
  expect(cardOf("ショップ2")?.querySelector('[data-badge="order"]')?.textContent).toBe("2");
  await expect.element(counted).not.toBeChecked();
  await expect.poll(async () => (await repository.plans.get(PLAN))?.orders[1]?.onHold).toBe(true);

  await label.click();
  await expect.poll(summaryText).toContain("4店舗を買い回り中");
});

test("held card shows the estimate struck through", async () => {
  const plan = marathonPlan([order(0), order(1), order(2), order(3, { onHold: true })]);
  await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));

  await expect.poll(heading).toBe("注文 4件（保留 1）");
  const held = cardOf("ショップ3");
  // Counting it again adds 通常 100 + SPU 200, and the marathon goes from +2倍 on three shops (600) to
  // +3倍 on four (1,200): 900P in all.
  const estimate = held?.querySelector("s");
  expect(estimate?.textContent).toContain("900P");
  expect(getComputedStyle(estimate as HTMLElement).textDecorationLine).toBe("line-through");
  expect(getComputedStyle(held as HTMLElement).borderStyle).toBe("dashed");
  expect(held?.querySelector('[data-badge="order"]')?.textContent).toBe("保留");
});

test("copy adds the order right after", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.poll(() => cards().length).toBe(4);
  toggleOf("ショップ1")?.click();
  await screen.getByRole("button", { name: "コピー" }).click();

  await expect.poll(() => cards().length).toBe(5);
  const shopsInOrder = cards().map((card) => card.textContent?.match(/ショップ\d/)?.[0]);
  expect(shopsInOrder).toEqual(["ショップ0", "ショップ1", "ショップ1", "ショップ2", "ショップ3"]);
  await expect.poll(async () => (await repository.plans.get(PLAN))?.orders.length).toBe(5);
});

test("delete asks first, then removes the order", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.poll(() => cards().length).toBe(4);
  toggleOf("ショップ2")?.click();
  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "キャンセル" }).click();
  expect(cards().length).toBe(4);

  await screen.getByRole("button", { name: "削除" }).click();
  await screen.getByRole("button", { name: "削除する" }).click();
  await expect.poll(() => cards().length).toBe(3);
  expect(cardOf("ショップ2")).toBeUndefined();
  await expect.poll(summaryText).toContain("3店舗を買い回り中");
});

test("reset asks first, then removes every order", async () => {
  const repository = createMemoryRepository({ shops, plans: [marathonPlan()] });
  const screen = await renderPlanHome(repository);

  await expect.poll(() => cards().length).toBe(4);
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
  const shopsInOrder = () => cards().map((card) => card.textContent?.match(/ショップ\d/)?.[0]);

  await expect.poll(() => cards().length).toBe(4);
  expect(screen.getByRole("button", { name: "ショップ0を上へ" }).query()).toBeNull();
  const reorder = screen.getByRole("button", { name: "並べ替え" });
  await expect.element(reorder).toHaveAttribute("aria-pressed", "false");
  await reorder.click();
  await expect.element(screen.getByRole("button", { name: "完了" })).toBeVisible();

  await expect.element(screen.getByRole("button", { name: "ショップ0を上へ" })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: "ショップ3を下へ" })).toBeDisabled();

  await screen.getByRole("button", { name: "ショップ0を下へ" }).click();
  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ0", "ショップ2", "ショップ3"]);

  // With the keyboard: Enter on the focused button moves the order up.
  screen.getByRole("button", { name: "ショップ2を上へ" }).element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.poll(shopsInOrder).toEqual(["ショップ1", "ショップ2", "ショップ0", "ショップ3"]);
  await expect
    .poll(async () => (await repository.plans.get(PLAN))?.orders.map((o) => o.shopId))
    .toEqual([shopId(1), shopId(2), shopId(0), shopId(3)]);

  await screen.getByRole("button", { name: "完了" }).click();
  expect(screen.getByRole("button", { name: "ショップ0を上へ" }).query()).toBeNull();
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
        <ul aria-label="注文">
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
        </ul>
      </Loaded>
    </Providers>,
  );

  await expect.poll(() => cardOf("ショップ0")?.textContent).toContain("400P");
  await expect.poll(() => cardOf("ショップ1")?.textContent).toContain("400P");
  const before = renders.get("card-1");

  const edited = order(0);
  edited.lineItems = edited.lineItems.map((item) => ({ ...item, unitPrice: 22000 }));
  await updateOrder?.(edited);

  await expect.poll(() => cardOf("ショップ0")?.textContent).toContain("800P");
  // Wait for the refetch that follows the save to settle as well.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(renders.get("card-0")).toBeGreaterThan(1);
  expect(renders.get("card-1")).toBe(before);
  expect(screen.container.textContent).toContain("¥22,000");
});
