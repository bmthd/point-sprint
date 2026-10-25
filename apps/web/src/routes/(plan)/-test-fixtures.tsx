import { QueryClient } from "@tanstack/react-query";
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
  NORMAL_POINT_ID,
  type OfficialEvent,
  type Order,
  type Plan,
  type Shop,
} from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { expect } from "vitest";
import { type Locator, page } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import type { ItemLookup } from "../../rakuten/item-lookup";
import { officialEventsSourceAtom } from "../-official-events";
import { repositoryAtom } from "../../state/repository";
import { itemLookupAtom } from "./-item-autofill";
import type { Repository } from "../../storage/repository";
import { PlanHome } from "./-plan-home/plan-home";

// Plans, shops and a rendered plan home shared by the plan home's browser tests.

export const PLAN = "f0000000-0000-4000-8000-00000000000a";

export const shopId = (index: number) =>
  `a0000000-0000-4000-8000-0000000000${String(index).padStart(2, "0")}`;

export const shops: Shop[] = Array.from({ length: 6 }, (_, index) => ({
  id: shopId(index),
  channel: "rakuten-ichiba",
  name: `ショップ${index}`,
  tags: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
}));

/** 通常ポイント, under its own id so that the plan's SPU does not add it again. */
export const baseBenefit: Benefit = {
  id: NORMAL_POINT_ID,
  kind: "rate-bonus",
  category: "base",
  label: "通常ポイント",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { rate: 1, roundingUnit: "item" },
};

export const spuBenefit: Benefit = {
  ...baseBenefit,
  id: "b0000000-0000-4000-8000-000000000002",
  category: "spu",
  label: "SPU",
  params: { rate: 2, roundingUnit: "item" },
};

export const campaignBenefit: Benefit = {
  ...baseBenefit,
  id: "b0000000-0000-4000-8000-000000000003",
  category: "campaign",
  label: "0と5のつく日",
  params: { rate: 1, roundingUnit: "item" },
};

/** The October marathon: +3倍 at 4 shops, up to +9倍 at 10 shops, capped at 7,000P. */
export const marathon: Benefit[] = [
  {
    id: "b31ed383-3fb7-425f-9391-70ecc965aa0e",
    kind: "shop-around",
    category: "campaign",
    label: "ショップ買いまわり",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "campaign",
    sharedKey: "marathon-2026-10",
    conditions: { dateRule: { type: "range", start: "2026-10-04", end: "2026-10-09" } },
    params: {
      tiers: Array.from({ length: 9 }, (_, index) => ({ minShops: index + 2, rate: index + 1 })),
      cap: 7000,
      roundingUnit: "item",
    },
  },
];

export const orderId = (index: number) =>
  `0${String(index).padStart(2, "0")}00000-0000-4000-8000-000000000000`;

/** An order of ¥11,000 per item (¥10,000 before tax) at shop `index`. */
export const order = (
  index: number,
  options: { onHold?: boolean; items?: number } = {},
): Order => ({
  id: orderId(index),
  shopId: shopId(index),
  date: "2026-10-05",
  lineItems: Array.from({ length: options.items ?? 1 }, (_, item) => ({
    id: `0${String(index).padStart(2, "0")}00000-0000-4000-8000-00000000000${item + 1}`,
    name: `商品${index}-${item + 1}`,
    unitPrice: 11000,
    quantity: 1,
    taxRate: 0.1,
    discount: 0,
  })),
  onHold: options.onHold ?? false,
  tags: [],
});

export const makePlan = (benefits: Benefit[], orders: Order[]): Plan => ({
  id: PLAN,
  name: "10月 お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits,
  orders,
  updatedAt: "2026-10-05T00:00:00.000Z",
});

/** Four counted shops of ¥11,000 (¥10,000 before tax), so the marathon is at +3倍. */
export const marathonPlan = (orders = [order(0), order(1), order(2), order(3)]) =>
  makePlan([baseBenefit, spuBenefit, ...marathon], orders);

function Hydrate({
  repository,
  itemLookup,
  events,
  children,
}: {
  repository: Repository;
  itemLookup: ItemLookup | undefined;
  events: OfficialEvent[] | undefined;
  children: ReactNode;
}) {
  useHydrateAtoms([
    [repositoryAtom, repository],
    [itemLookupAtom, { lookup: itemLookup }],
    ...(events ? [[officialEventsSourceAtom, { load: async () => events }] as const] : []),
  ]);
  return children;
}

/**
 * The app's providers; the item lookup is `itemLookup`, and off without one. The official events
 * are `events`, or the Worker's without them.
 */
export function Providers({
  repository,
  itemLookup,
  events,
  children,
}: {
  repository: Repository;
  itemLookup?: ItemLookup;
  events?: OfficialEvent[];
  children: ReactNode;
}) {
  return (
    <UIProvider theme={theme} config={config}>
      <QueryClientAtomProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Hydrate repository={repository} itemLookup={itemLookup} events={events}>
          {children}
        </Hydrate>
      </QueryClientAtomProvider>
    </UIProvider>
  );
}

export async function renderPlanHome(
  repository: Repository,
  path = `/plan?id=${PLAN}`,
  itemLookup?: ItemLookup,
  events?: OfficialEvent[],
) {
  await cleanup();
  const root = createRootRoute({ component: Outlet });
  const planRoute = createRoute({
    getParentRoute: () => root,
    path: "/plan",
    component: () => <PlanHome id={PLAN} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([planRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(
    <Providers repository={repository} itemLookup={itemLookup} events={events}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return Object.assign(screen, { router });
}

export const summary = () => page.getByRole("region", { name: "サマリー" });

/** Expects one item per shop, in this order, each holding its shop's name. */
export async function expectShopsInOrder(items: Locator, shops: string[]) {
  await expect.element(items).toHaveLength(shops.length);
  for (const [index, shop] of shops.entries()) {
    await expect.element(items.nth(index)).toMatchTextContent(shop);
  }
}

/**
 * Taps a checkbox card (an SPU tile, a campaign, 39ショップ). Its checkbox is visually hidden under the card, so
 * the card (its label) is tapped. Locators cannot reach an element's parent, so the label is found from the
 * checkbox.
 */
export const tapCard = (tile: Locator) => {
  const label = tile.element().closest("label");
  if (!label) throw new Error("no card label");
  return page.elementLocator(label).click();
};

/** The order's shop field: typed to find a saved shop, or to name a new one. */
export const shopField = (scope: Pick<Locator, "getByRole">) =>
  scope.getByRole("textbox", { name: /^ショップ/ });

/**
 * Puts a shop on the order being entered: a saved shop by its name, a new shop of a name no
 * saved shop has, or none with "".
 */
export const enterShop = (scope: Pick<Locator, "getByRole">, name: string) =>
  shopField(scope).fill(name);

/** Chooses the item's tax rate by its label (「10%」, 「8%（食品）」 or 「非課税」), as a tap does. */
export const chooseTaxRate = (scope: Pick<Locator, "getByRole">, label: string) =>
  // The choice's radio is hidden under its label: the label is what is pressed.
  scope.getByRole("radiogroup").getByText(label, { exact: true }).click();
