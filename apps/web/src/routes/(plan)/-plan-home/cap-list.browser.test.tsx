import type { Benefit, Order, Plan } from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../../storage/memory-repository";
import {
  PLAN,
  baseBenefit,
  marathon,
  renderPlanHome,
  shopId,
  shops,
  summary,
} from "../-test-fixtures";

const FIRST = "f0000000-0000-4000-8000-0000000000f1";

/** +1倍, at most 100P a month, shared between the plans. */
const card: Benefit = {
  id: "b0000000-0000-4000-8000-0000000000c1",
  kind: "rate-bonus",
  category: "spu",
  label: "楽天カード特典分",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "month",
  sharedKey: "card",
  params: { rate: 1, roundingUnit: "item", cap: 100 },
};

const order = (unitPrice: number): Order => ({
  id: "01000000-0000-4000-8000-000000000000",
  shopId: shopId(0),
  date: "2026-10-05",
  lineItems: [
    {
      id: "01000000-0000-4000-8000-000000000001",
      name: "商品",
      unitPrice,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
});

const plan = (id: string, name: string, start: string, end: string, over: Partial<Plan>): Plan => ({
  id,
  name,
  period: { start, end },
  benefits: [baseBenefit, card],
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
  ...over,
});

/** 1回目 used `unitPrice` yen of October's card cap; 2回目, the plan shown, has no orders yet. */
const plans = (unitPrice: number, benefits?: Benefit[]) => [
  plan(FIRST, "1回目", "2026-10-04", "2026-10-09", { orders: [order(unitPrice)] }),
  plan(PLAN, "2回目", "2026-10-20", "2026-10-25", benefits ? { benefits } : {}),
];

const caps = () => page.getByRole("region", { name: "上限までの残り" });
const cardRow = () => caps().getByRole("listitem").filter({ hasText: "楽天カード特典分" });

beforeEach(async () => {
  await page.viewport(1280, 900);
});

test("a cap shows what other plans used and the price that fills it", async () => {
  // 1回目: ¥3,300 → ¥3,000 before tax → 30P of October's 100P.
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: plans(3300) }));
  await expect.element(cardRow()).toMatchTextContent("10月");
  await expect.element(cardRow()).toMatchTextContent("1回目と共有");
  await expect.element(cardRow()).toMatchTextContent("30 / 100P");
  // 70P at +1倍 is ¥7,000 before tax; at 10% the smallest price is ¥7,699.
  await expect.element(cardRow()).toMatchTextContent("あと¥7,699");
  // The choice's radio is hidden under its label: the label is what is pressed.
  await screen
    .getByRole("radiogroup", { name: "買う商品の税率" })
    .getByText("非課税", { exact: true })
    .click();
  await expect.element(cardRow()).toMatchTextContent("あと¥7,000");
});

test("a cap that is used up is under its own heading", async () => {
  // 1回目: ¥11,000 → 100P, the whole cap.
  await renderPlanHome(createMemoryRepository({ shops, plans: plans(11000) }));
  await expect.element(caps()).toMatchTextContent(/上限に届いた特典.*楽天カード特典分/);
  await expect.element(cardRow()).toMatchTextContent("上限");
  await expect.element(cardRow()).not.toMatchTextContent("あと¥");
});

test("without a capped benefit there is no list", async () => {
  await renderPlanHome(createMemoryRepository({ shops, plans: plans(3300, [baseBenefit]) }));
  await expect.element(summary()).toBeInTheDocument();
  await expect.element(caps()).not.toBeInTheDocument();
});

test("the caps are in the order the least money fills them", async () => {
  // The plan's own 1,000P cap needs more money than the card's 70P, and the marathon's rate is
  // 0 with no shops yet, so no money fills it.
  const ownCap: Benefit = {
    ...card,
    id: "b0000000-0000-4000-8000-0000000000c2",
    label: "キャンペーン",
    capScope: "plan",
    sharedKey: undefined,
    params: { rate: 1, roundingUnit: "item", cap: 1000 },
  };
  await renderPlanHome(
    createMemoryRepository({
      shops,
      plans: plans(3300, [baseBenefit, ownCap, ...marathon, card]),
    }),
  );
  const rows = caps().getByRole("listitem");
  await expect.element(rows.nth(0)).toMatchTextContent("楽天カード特典分");
  await expect.element(rows.nth(1)).toMatchTextContent("キャンペーン");
  await expect.element(rows.nth(2)).toMatchTextContent("—");
  await expect.element(summary()).not.toMatchTextContent("次に上限に届くのは");
});

test("caps one price fills alike are one row", async () => {
  const spu = (id: string, label: string): Benefit => ({
    ...card,
    id,
    label,
    sharedKey: undefined,
    params: { rate: 0.5, roundingUnit: "item", cap: 1000 },
  });
  await renderPlanHome(
    createMemoryRepository({
      shops,
      plans: plans(3300, [
        baseBenefit,
        spu("b0000000-0000-4000-8000-0000000000d1", "楽天銀行"),
        spu("b0000000-0000-4000-8000-0000000000d2", "楽天でんき"),
      ]),
    }),
  );
  const row = caps().getByRole("listitem");
  await expect.element(row).toMatchTextContent("楽天銀行・楽天でんき");
  await expect.element(row).toMatchTextContent("0 / 1,000P（それぞれ）");
});

test("a cap of some days and tags says which orders fill it", async () => {
  const limited: Benefit = {
    ...card,
    id: "b0000000-0000-4000-8000-0000000000e1",
    label: "24時間限定",
    capScope: "occurrence",
    sharedKey: undefined,
    conditions: { orderTags: ["24h"], dateRule: { type: "dates", dates: ["2026-10-22"] } },
    params: { rate: 9, roundingUnit: "item", cap: 10000 },
  };
  await renderPlanHome(
    createMemoryRepository({ shops, plans: plans(3300, [baseBenefit, limited]) }),
  );
  await expect
    .element(caps().getByRole("listitem"))
    .toMatchTextContent("10/22・24時間限定の注文で");
});
