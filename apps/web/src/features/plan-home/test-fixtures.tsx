import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { type Benefit, type Order, type Plan, type Shop, officialEvents } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { QueryClientAtomProvider } from "jotai-tanstack-query/react";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { cleanup, render } from "vitest-browser-react";
import { repositoryAtom } from "../../state/repository";
import type { Repository } from "../../storage/repository";
import { PlanHome } from "./plan-home";

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

export const baseBenefit: Benefit = {
  id: "b0000000-0000-4000-8000-000000000001",
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

/** The October marathon: +3倍 at 4 shops, up to +9倍 at 10 shops. */
export const marathon = officialEvents[0]?.benefits ?? [];

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

function Hydrate({ repository, children }: { repository: Repository; children: ReactNode }) {
  useHydrateAtoms([[repositoryAtom, repository]]);
  return children;
}

export function Providers({
  repository,
  children,
}: {
  repository: Repository;
  children: ReactNode;
}) {
  return (
    <UIProvider theme={theme} config={config}>
      <QueryClientAtomProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Hydrate repository={repository}>{children}</Hydrate>
      </QueryClientAtomProvider>
    </UIProvider>
  );
}

export async function renderPlanHome(repository: Repository, path = `/plan?id=${PLAN}`) {
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
    <Providers repository={repository}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return Object.assign(screen, { router });
}

export const summaryText = () =>
  document.querySelector('section[aria-label="サマリー"]')?.textContent;
