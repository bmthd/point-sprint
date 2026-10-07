import type { Order } from "@workspaces/domain";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { updateOrderAtom } from "../../state/order-ops";
import { plansQueryAtom, shopsQueryAtom } from "../../state/queries";
import { createMemoryRepository } from "../../storage/memory-repository";
import { OrderList } from "./order-list";
import {
  PLAN,
  Providers,
  baseBenefit,
  campaignBenefit,
  makePlan,
  order,
  orderId,
  shops,
  spuBenefit,
} from "./test-fixtures";

const cardRenders = vi.hoisted(() => new Map<string, number>());

// Every card is wrapped in a Profiler that counts its commits by order id. The wrapper keeps the
// card's own `memo` (and its comparison), so the list renders cards exactly as it does in the app.
vi.mock("./order-card", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./order-card")>();
  const { createElement, memo, Profiler: ProfilerComponent } = await import("react");
  type Props = Parameters<typeof actual.OrderCard>[0];
  const card = actual.OrderCard as unknown as {
    type?: (props: Props) => ReactNode;
    compare?: (a: Props, b: Props) => boolean;
  };
  const Inner = (card.type ?? actual.OrderCard) as (props: Props) => ReactNode;
  const Counted = (props: Props) =>
    createElement(
      ProfilerComponent,
      {
        id: props.orderId,
        onRender: (id: string) => cardRenders.set(id, (cardRenders.get(id) ?? 0) + 1),
      },
      createElement(Inner, props),
    );
  return { ...actual, OrderCard: card.type ? memo(Counted, card.compare ?? undefined) : Counted };
});

const cardOf = (shop: string) =>
  Array.from(document.querySelectorAll('ul[aria-label="注文"] > li')).find((card) =>
    card.textContent?.includes(shop),
  );

test("editing one order does not re-render the other cards of the list", async () => {
  await page.viewport(390, 844);
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
    return loadedShops.isSuccess && loaded ? <OrderList plan={loaded} onEdit={noop} /> : null;
  }

  cardRenders.clear();
  await render(
    <Providers repository={memory}>
      <Loaded />
    </Providers>,
  );

  await expect.poll(() => cardOf("ショップ0")?.textContent).toContain("400P");
  await expect.poll(() => cardOf("ショップ1")?.textContent).toContain("400P");
  const before = cardRenders.get(orderId(1));

  const edited = order(0);
  edited.lineItems = edited.lineItems.map((item) => ({ ...item, unitPrice: 22000 }));
  await updateOrder?.(edited);

  await expect.poll(() => cardOf("ショップ0")?.textContent).toContain("800P");
  // Wait for the refetch that follows the save to settle as well.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(cardRenders.get(orderId(0))).toBeGreaterThan(1);
  expect(cardRenders.get(orderId(1))).toBe(before);
});
