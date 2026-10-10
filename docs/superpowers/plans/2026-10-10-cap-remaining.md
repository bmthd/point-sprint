# 上限までの残り Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プランのホームで、上限のある特典ごとに「あといくら買えば上限をちょうど使い切るか」を、同じアカウントのほかのプランで使った分を差し引いて見せる（A・C・B）。

**Architecture:** `calculateAll` は、共有の枠を注文日の早い順に配るように直し、結果に枠ごとの使用状況（`capUsage`）を足す。`packages/domain` の純粋な関数 `capLines`（枠ごとの行）、`priceToFill`（ちょうど使い切る税込額）、`capFlows`（打った金額の行き先）がそれを読む。Web は `useCapLines` で行を作り、一覧（A）、サマリーの 1 行（C）、追加フォームの行き先（B）に出す。

**Tech Stack:** TypeScript, valibot, vitest（domain）、React + Yamada UI v2（`@workspaces/ui`）、jotai、Formisch、vitest browser、Playwright

**Spec:** GitHub Issue #116（`gh issue view 116`）

## Global Constraints

- 共有の枠が足りないときは、注文日の早い順に配る。同じ日の中は、いまと同じく生のポイントの比で配る
- A と C の金額は、選んだ税率（10% / 8% / 非課税）の商品を 1 つ買うとして、上限をちょうど使い切る最小の税込額。端数は計算と同じ切り捨て
- 保留の注文は「使った分」に数えない（計算から外れているので自然にそうなる）
- マラソン（買いまわり）の行は、いまの店舗数の倍率で残りを出す
- 月間の枠は、プランの期間にかかる月ごとに行を出す。1 日の枠は、今日が期間の中なら今日、外なら期間の最初の日
- C は、サマリーの「上限まであと 約X万円 買えます」とマラソンのゲージを置き換える。ゲージは A に移る
- B は、金額を打ったときだけ、上限のある特典に入るポイントがあるときだけ出す
- 部品は `@workspaces/ui` から選ぶ。見た目やライブラリの機能はテストしない
- React に依存しない計算は `packages/domain`。1 ルートだけで使うものはそのルートの隣、2 つ以上はいちばん近い共通の親

## Review Focus

1. **2 回目のマラソンを後から足す。** 1 回目のプランの数字（ポイントと残り）は変わらない → Task 1 のテスト
2. **まだ注文のないプラン（2 回目）を開く。** 1 回目で使った月間の枠は使用済みとして見え、残りはその分だけ少ない → Task 2 のテスト
3. **別のアカウントのプランで使った分。** 差し引かない → Task 2 のテスト
4. **店舗数が足りず、マラソンの倍率が 0。** 金額は出せないので「—」。C の候補に入れない → Task 2・Task 4 のテスト
5. **月をまたぐプラン（9/28〜10/3 など）。** 月間の枠が 9 月と 10 月の 2 行になる → Task 2 のテスト

---

## ファイルの構成

| ファイル | 役割 |
| --- | --- |
| `packages/domain/src/calculate/calculate.ts`（変更） | 共有の枠を注文日の早い順に配る。結果に `capUsage` を足す |
| `packages/domain/src/calculate/types.ts`（変更） | `CapGroupUsage` と `CalculationResult.capUsage` |
| `packages/domain/src/calculate/fill-price.ts`（新規） | `pointsForPrice` / `priceToFill`: 税込の価格とポイントの行き来 |
| `packages/domain/src/calculate/cap-lines.ts`（新規） | `capLines`: プランの、上限のある特典の枠ごとの行 |
| `packages/domain/src/calculate/cap-flows.ts`（新規） | `capFlows`: 下書きの注文のポイントが各枠にいくら入り、いくらはみ出すか |
| `packages/domain/src/index.ts`（変更） | 上の export |
| `apps/web/src/routes/-use-today.ts`（新規、`(site)/-plan-list/plan-list.tsx` から移す） | `useToday`。プランの一覧とプランのホームの両方が使う |
| `apps/web/src/routes/(plan)/-cap-lines.ts`（新規） | `useCapLines(plan, day)`、枠の名前（`scopeText`）、共有の文言（`sharedText`）、`yen` |
| `apps/web/src/routes/(plan)/-plan-home/cap-list.tsx`（新規） | A: 上限までの残りの一覧と税率の切り替え |
| `apps/web/src/routes/(plan)/-plan-home/summary-card.tsx`（変更） | C: 次に届く上限の 1 行。ゲージと「約X万円」を外す |
| `apps/web/src/routes/(plan)/-plan-home/plan-home.tsx`（変更） | A の配置、税率の状態 |
| `apps/web/src/routes/(plan)/-cap-flows.tsx`（新規） | B: 行き先の表示と「¥X で使い切る」ボタン。追加フォームと編集シートの両方が使う |
| `apps/web/src/routes/(plan)/-plan-home/order-add-form.tsx`、`-order-editor/order-editor.tsx`（変更） | B を置く（新しい注文のときだけ） |

---

### Task 1: 共有の枠を注文日の早い順に配る

**Files:**
- Modify: `packages/domain/src/calculate/calculate.ts`（`BenefitItem`、`planPhase`、`applyCap`）
- Test: `packages/domain/src/calculate/calculate-all.test.ts`

**Interfaces:**
- Produces: `BenefitItem` に `date: string`（注文日）。`applyCap` の配り方が変わる（公開の型は変わらない）

- [ ] **Step 1: 失敗するテストを書く**（`describe("calculateAll")` の中、`"campaign scope shares one cap across plans"` の後）

```ts
  test("a shared cap goes to the earlier orders first", () => {
    const b = bonus({ capScope: "campaign", sharedKey: "marathon-2026-10", cap: 15 });
    const first = plan(PLAN_1, [order(ORDER_1, ITEM_1, "2026-10-05")], [b]);
    const alone = calculateAll([first], shops);
    // The second plan's id sorts first, but its order is later: it gets only what is left.
    const results = calculateAll(
      [plan("e0000000-0000-4000-8000-000000000001", [order(ORDER_2, ITEM_2, "2026-10-20")], [b]), first],
      shops,
    );
    expect(resultOf(results, PLAN_1).total).toBe(resultOf(alone, PLAN_1).total);
    expect(pointsOf(resultOf(results, PLAN_1), ITEM_1)).toBe(10);
    expect(pointsOf(resultOf(results, "e0000000-0000-4000-8000-000000000001"), ITEM_2)).toBe(5);
    expectTotalsMatchBreakdown(results);
  });

  test("within one plan, the earlier order gets the cap first", () => {
    const results = calculateAll(
      [
        plan(
          PLAN_1,
          [order(ORDER_1, ITEM_1, "2026-10-06"), order(ORDER_2, ITEM_2, "2026-10-05", SHOP_B)],
          [bonus({ cap: 15 })],
        ),
      ],
      shops,
    );
    const r1 = resultOf(results, PLAN_1);
    expect(pointsOf(r1, ITEM_2)).toBe(10);
    expect(pointsOf(r1, ITEM_1)).toBe(5);
    expectTotalsMatchBreakdown(results);
  });
```

`"month cap is shared across plans"`（同じ日の 2 注文で 8 / 7）は、同じ日の中は比で配るので変わらないことを確かめるテストとして残す。

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run packages/domain/src/calculate/calculate-all.test.ts`
Expected: 新しい 2 つが FAIL（いまは比で 8 / 7 に配るため）

- [ ] **Step 3: 実装する**

`BenefitItem` に `date: string` を足し、`planPhase` で `date: orderDate` を入れる。`applyCap` を次に置き換える。

```ts
/**
 * Caps each group and writes the allocated points back onto its members. The earlier orders get
 * the cap first, so adding a later plan never takes points from an earlier one; the members of
 * one day split what is left by their raw points.
 */
function applyCap(group: CapGroup): void {
  const { cap, mismatch } = resolveGroupCap(group.caps);
  const rawSum = group.members.reduce((sum, member) => sum + member.raw, 0);
  group.mismatch = mismatch;
  group.capReached = cap !== undefined && rawSum >= cap;
  if (cap === undefined || rawSum <= cap) return;
  const days = Map.groupBy(
    [...group.members].sort((a, b) => compareIds(a.date, b.date) || byPlanThenLineItem(a, b)),
    (member) => member.date,
  );
  let left = cap;
  for (const members of days.values()) {
    const raws = members.map((member) => member.raw);
    const share = Math.min(
      left,
      raws.reduce((sum, points) => sum + points, 0),
    );
    const allocated = largestRemainder(share, raws);
    members.forEach((member, index) => {
      member.points = allocated[index] ?? 0;
    });
    left -= share;
  }
}
```

`Map.groupBy` が型で使えなければ（`lib` が ES2024 未満）、`for` で `Map<string, BenefitItem[]>` に積む。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run packages/domain`
Expected: すべて PASS。ほかに落ちるテストがあれば、日付の違う注文の配り方を前提にしていないか読み、前提が「比で配る」ならテストの期待を新しい規則に直す（直した理由をコミットに書く）

- [ ] **Step 5: コミット**

```bash
git add packages/domain/src/calculate
git commit -m "共有の上限は、注文日の早い注文から先に配る"
```

---

### Task 2: 枠の使用状況と、上限までの残りの行（domain）

**Files:**
- Modify: `packages/domain/src/calculate/types.ts`, `packages/domain/src/calculate/calculate.ts`, `packages/domain/src/index.ts`
- Create: `packages/domain/src/calculate/fill-price.ts`, `packages/domain/src/calculate/cap-lines.ts`
- Test: `packages/domain/src/calculate/fill-price.test.ts`, `packages/domain/src/calculate/cap-lines.test.ts`

**Interfaces:**
- Consumes: Task 1 の `calculateAll`
- Produces:
  - `type CapGroupUsage = { cap: number | undefined; raw: number; points: Record<string, number> }`
  - `CalculationResult.capUsage: Record<string, CapGroupUsage>`（キーは `capGroupKey`。そのプランと同じアカウントの枠だけ）
  - `type TaxRate = LineItem["taxRate"]`
  - `pointsForPrice(price: number, taxRate: TaxRate, rate: number, amountBasis: Benefit["amountBasis"]): number`
  - `priceToFill(points: number, taxRate: TaxRate, rate: number, amountBasis: Benefit["amountBasis"]): number | null`
  - `type CapLine = { benefit: Benefit; key: string; scope: Benefit["capScope"]; period: string | null; cap: number; usedHere: number; usedElsewhere: number; sharedWith: string[]; remaining: number; rate: number }`
  - `capLines(plan: Plan, result: Pick<CalculationResult, "capUsage" | "shopCount">, day: string | undefined): CapLine[]`

- [ ] **Step 1: `priceToFill` の失敗するテストを書く**（`fill-price.test.ts`）

```ts
import { describe, expect, test } from "vitest";
import { pointsForPrice, priceToFill } from "./fill-price";

describe("priceToFill", () => {
  test.each([
    // 10,999 yen incl. 10% is 10,000 yen excl. tax (999 yen of tax is rounded down).
    [0.1, 10999],
    [0.08, 10799],
    [0, 10000],
  ] as const)("the smallest tax-included price that earns 100P at +1, tax %s", (taxRate, price) => {
    expect(priceToFill(100, taxRate, 1, "tax-excluded")).toBe(price);
    expect(pointsForPrice(price, taxRate, 1, "tax-excluded")).toBe(100);
    expect(pointsForPrice(price - 1, taxRate, 1, "tax-excluded")).toBe(99);
  });

  test("a tax-included basis counts the price itself", () => {
    expect(priceToFill(100, 0.1, 1, "tax-included")).toBe(10000);
  });

  test("a fractional rate", () => {
    const price = priceToFill(7000, 0.1, 9, "tax-excluded");
    expect(price).not.toBeNull();
    expect(pointsForPrice(price ?? 0, 0.1, 9, "tax-excluded")).toBe(7000);
    expect(pointsForPrice((price ?? 0) - 1, 0.1, 9, "tax-excluded")).toBeLessThan(7000);
  });

  test("nothing to fill costs nothing; a zero rate never fills", () => {
    expect(priceToFill(0, 0.1, 1, "tax-excluded")).toBe(0);
    expect(priceToFill(100, 0.1, 0, "tax-excluded")).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `pnpm vitest run packages/domain/src/calculate/fill-price.test.ts` / Expected: FAIL（モジュールがない）

- [ ] **Step 3: `fill-price.ts` を書く**

```ts
import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import type { Benefit } from "../model/benefit";
import type { LineItem } from "../model/order";

export type TaxRate = LineItem["taxRate"];

const toBp = (rate: number) => Math.round(rate * 100);

/** Points one item at a tax-included `price` earns at +`rate`倍, rounded down like the calculation. */
export function pointsForPrice(
  price: number,
  taxRate: TaxRate,
  rate: number,
  amountBasis: Benefit["amountBasis"],
): number {
  const item: LineItem = { id: "", name: "", unitPrice: price, quantity: 1, taxRate, discount: 0 };
  const target = amountBasis === "tax-included" ? taxIncludedTarget(item) : taxExcludedTarget(item);
  return Math.floor((target * toBp(rate)) / 10000);
}

/**
 * The smallest tax-included price of one item that earns `points` at +`rate`倍. `null` when the
 * rate is 0, so no price earns anything.
 */
export function priceToFill(
  points: number,
  taxRate: TaxRate,
  rate: number,
  amountBasis: Benefit["amountBasis"],
): number | null {
  if (points <= 0) return 0;
  const rateBp = toBp(rate);
  if (rateBp <= 0) return null;
  // Twice the tax-excluded amount is more than enough at any tax rate up to 10%.
  let low = 0;
  let high = 2 * Math.ceil((points * 10000) / rateBp) + 2;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (pointsForPrice(mid, taxRate, rate, amountBasis) >= points) high = mid;
    else low = mid + 1;
  }
  return low;
}
```

- [ ] **Step 4: 通ることを確かめる** — Run: 同上 / Expected: PASS

- [ ] **Step 5: `capLines` の失敗するテストを書く**（`cap-lines.test.ts`。`calculate-all.test.ts` と同じ形の小さな fixture をこのファイルに書く）

```ts
import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculateAll } from "./calculate";
import { capLines } from "./cap-lines";

const SHOP = "a0000000-0000-4000-8000-000000000001";
const FIRST = "f0000000-0000-4000-8000-000000000001";
const SECOND = "f0000000-0000-4000-8000-000000000002";
const OTHER_ACCOUNT = "acc00000-0000-4000-8000-000000000002";
const CARD = "5b000000-0000-4000-8000-000000000001";
const MARATHON = "5a000000-0000-4000-8000-000000000002";

const shops: Shop[] = [
  { id: SHOP, channel: "rakuten-ichiba", name: "shop", tags: [], updatedAt: "2026-10-04T00:00:00Z" },
];

/** +1倍, at most 100P a month, shared between plans by `sharedKey`. */
const card: Benefit = {
  id: CARD,
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

/** +1倍 from 2 shops, at most 50P in the plan. */
const marathon: Benefit = {
  id: MARATHON,
  kind: "shop-around",
  category: "campaign",
  label: "お買い物マラソン",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { tiers: [{ minShops: 2, rate: 1 }], roundingUnit: "item", cap: 50 },
};

/** One order of `taxIncluded` yen at 10%. */
const order = (id: string, date: string, taxIncluded: number, onHold = false): Order => ({
  id: `0${id}000000-0000-4000-8000-000000000001`,
  shopId: SHOP,
  date,
  lineItems: [
    { id: `${id}0000000-0000-4000-8000-000000000001`, name: "", unitPrice: taxIncluded, quantity: 1, taxRate: 0.1, discount: 0 },
  ],
  onHold,
  tags: [],
});

const plan = (id: string, start: string, end: string, orders: Order[], over: Partial<Plan> = {}): Plan => ({
  id,
  name: id,
  period: { start, end },
  benefits: [card, marathon],
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
  ...over,
});

const linesOf = (plans: Plan[], target: Plan, day?: string) => {
  const result = calculateAll(plans, shops).get(target.id);
  if (!result) throw new Error("no result");
  return capLines(target, result, day);
};

describe("capLines", () => {
  test("another plan's use of a shared month cap counts against a plan with no orders", () => {
    // 3,300 yen incl. tax → 3,000 excl. → 30P of the card's 100P in October.
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const second = plan(SECOND, "2026-10-20", "2026-10-25", []);
    const [line] = linesOf([first, second], second).filter((l) => l.benefit.id === CARD);
    expect(line).toMatchObject({
      scope: "month",
      period: "2026-10",
      cap: 100,
      usedHere: 0,
      usedElsewhere: 30,
      sharedWith: [FIRST],
      remaining: 70,
      rate: 1,
    });
  });

  test("a held order is not counted as used", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300, true)]);
    const [line] = linesOf([first], first).filter((l) => l.benefit.id === CARD);
    expect(line).toMatchObject({ usedHere: 0, usedElsewhere: 0, remaining: 100 });
  });

  test("another account's plan does not use the cap", () => {
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      accountId: OTHER_ACCOUNT,
    });
    const second = plan(SECOND, "2026-10-20", "2026-10-25", []);
    const [line] = linesOf([first, second], second).filter((l) => l.benefit.id === CARD);
    expect(line).toMatchObject({ usedElsewhere: 0, sharedWith: [], remaining: 100 });
  });

  test("a plan across two months has a month line for each", () => {
    const across = plan(FIRST, "2026-09-28", "2026-10-03", [order("1", "2026-10-01", 3300)]);
    const months = linesOf([across], across).filter((l) => l.benefit.id === CARD);
    expect(months.map((l) => [l.period, l.remaining])).toEqual([
      ["2026-09", 100],
      ["2026-10", 70],
    ]);
  });

  test("a capped rate of 0 still has a line, with the rate it has now", () => {
    // One shop: the marathon's rate is 0, so no amount fills its cap yet.
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)]);
    const [line] = linesOf([first], first).filter((l) => l.benefit.id === MARATHON);
    expect(line).toMatchObject({ scope: "plan", period: null, cap: 50, rate: 0, remaining: 50 });
  });

  test("a day cap is today's in the period, else the first day's", () => {
    const daily = { ...card, capScope: "day" as const };
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [order("1", "2026-10-05", 3300)], {
      benefits: [daily],
    });
    expect(linesOf([first], first, "2026-10-05")[0]).toMatchObject({ period: "2026-10-05", remaining: 70 });
    expect(linesOf([first], first, "2026-11-01")[0]).toMatchObject({ period: "2026-10-04", remaining: 100 });
    expect(linesOf([first], first, undefined)[0]).toMatchObject({ period: "2026-10-04" });
  });

  test("benefits without a cap, and disabled ones, have no line", () => {
    const { cap: _, ...uncapped } = card.params;
    const first = plan(FIRST, "2026-10-04", "2026-10-09", [], {
      benefits: [{ ...card, params: uncapped }, { ...marathon, enabled: false }],
    });
    expect(linesOf([first], first)).toEqual([]);
  });
});
```

- [ ] **Step 6: 失敗を確かめる** — Run: `pnpm vitest run packages/domain/src/calculate/cap-lines.test.ts` / Expected: FAIL（モジュールがない）

- [ ] **Step 7: `capUsage` を結果に足す**

`types.ts`:

```ts
/** How much of one cap group is used, by plan. */
export type CapGroupUsage = {
  /** The group's resolved cap; `undefined` when no copy of the benefit has one. */
  cap: number | undefined;
  /** Raw points of every member, before the cap. */
  raw: number;
  /** Points each plan received from the group after the cap, keyed by plan ID. */
  points: Record<string, number>;
};
```

`CalculationResult` に足す:

```ts
  /**
   * Cap groups of the plan's account, keyed by `capGroupKey`, including the ones only other plans
   * use. Held orders are not in them.
   */
  capUsage: Record<string, CapGroupUsage>;
```

`calculate.ts`: `CapGroup` に `accountId: string` を足し、`collectGroups` でグループを作るときに `planAccountId(phase.plan)` を入れる（`for (const { plan, entries } of phases)`）。`calculateCore` で配った後に使用状況を作り、`assemble` に渡す。

```ts
function usageOf(group: CapGroup): CapGroupUsage {
  const points: Record<string, number> = {};
  for (const member of group.members) {
    points[member.planId] = (points[member.planId] ?? 0) + member.points;
  }
  const raw = group.members.reduce((sum, member) => sum + member.raw, 0);
  return { cap: resolveGroupCap(group.caps).cap, raw, points };
}

/** The usage of every group of `accountId`. */
function capUsageOf(groups: Map<string, CapGroup>, accountId: string): Record<string, CapGroupUsage> {
  const usage: Record<string, CapGroupUsage> = {};
  for (const [key, group] of groups) {
    if (group.accountId === accountId) usage[key] = usageOf(group);
  }
  return usage;
}
```

`assemble` の戻り値に `capUsage: capUsageOf(groups, planAccountId(phase.plan))` を足す。`Map` ではなく `Record` にするのは、web の `deepEqual` が `Map` の中身を比べないため。

- [ ] **Step 8: `cap-lines.ts` を書く**

```ts
import { tierRate } from "../benefit-kinds/shop-around";
import type { Benefit } from "../model/benefit";
import { type Plan, planAccountId } from "../model/plan";
import { capGroupKey } from "./cap-groups";
import type { CalculationResult } from "./types";

/** One cap of one benefit of a plan: how much of it is used, and what is left. */
export type CapLine = {
  benefit: Benefit;
  /** The cap group's key (`capGroupKey`). */
  key: string;
  scope: Benefit["capScope"];
  /** `YYYY-MM` for a month cap, `YYYY-MM-DD` for a day cap, otherwise `null`. */
  period: string | null;
  cap: number;
  /** Points this plan received from the cap. */
  usedHere: number;
  /** Points the other plans of the account received from the cap. */
  usedElsewhere: number;
  /** IDs of the other plans that received points from the cap. */
  sharedWith: string[];
  /** Points the cap can still give: the cap minus the raw points of every member. */
  remaining: number;
  /** +N倍 one more yen earns; a shop-around benefit's rate at the plan's shop count. */
  rate: number;
};

/** `YYYY-MM` of every month the period touches. */
function monthsOf(period: Plan["period"]): string[] {
  const months: string[] = [];
  let [year, month] = period.start.slice(0, 7).split("-").map(Number) as [number, number];
  const last = period.end.slice(0, 7);
  for (;;) {
    const current = `${year}-${String(month).padStart(2, "0")}`;
    months.push(current);
    if (current >= last) return months;
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
}

/** The dates whose groups a benefit's lines show, and each line's `period`. */
function datesOf(benefit: Benefit, plan: Plan, day: string): { date: string; period: string | null }[] {
  switch (benefit.capScope) {
    case "plan":
    case "campaign":
      return [{ date: plan.period.start, period: null }];
    case "month":
      return monthsOf(plan.period).map((month) => ({ date: `${month}-01`, period: month }));
    case "day":
      return [{ date: day, period: day }];
  }
}

function rateOf(benefit: Benefit, shopCount: number): number {
  switch (benefit.kind) {
    case "rate-bonus":
      return benefit.params.rate;
    case "shop-around":
      return tierRate(benefit.params.tiers, shopCount);
  }
}

/**
 * The caps of the plan's enabled benefits that have one, with how much of each is used. Month caps
 * have a line for each month of the period; a day cap is `day`'s when it is in the period, and
 * otherwise the first day's. `plan` must have the account it was calculated with.
 */
export function capLines(
  plan: Plan,
  result: Pick<CalculationResult, "capUsage" | "shopCount">,
  day: string | undefined,
): CapLine[] {
  const { start, end } = plan.period;
  const capDay = day !== undefined && day >= start && day <= end ? day : start;
  const owner = { id: plan.id, accountId: planAccountId(plan) };
  return plan.benefits
    .filter((benefit) => benefit.enabled)
    .flatMap((benefit) =>
      datesOf(benefit, plan, capDay).flatMap(({ date, period }): CapLine[] => {
        const key = capGroupKey(owner, benefit, date);
        const usage = result.capUsage[key];
        const caps = [usage?.cap, benefit.params.cap].filter((cap) => cap !== undefined);
        if (caps.length === 0) return [];
        const cap = Math.min(...caps);
        const points = usage?.points ?? {};
        const others = Object.entries(points).filter(([id, used]) => id !== plan.id && used > 0);
        return [
          {
            benefit,
            key,
            scope: benefit.capScope,
            period,
            cap,
            usedHere: points[plan.id] ?? 0,
            usedElsewhere: others.reduce((sum, [, used]) => sum + used, 0),
            sharedWith: others.map(([id]) => id),
            remaining: Math.max(0, cap - (usage?.raw ?? 0)),
            rate: rateOf(benefit, result.shopCount),
          },
        ];
      }),
    );
}
```

`index.ts` に足す:

```ts
export { capLines, type CapLine } from "./calculate/cap-lines";
export { pointsForPrice, priceToFill, type TaxRate } from "./calculate/fill-price";
```

`types.ts` の export 一覧に `CapGroupUsage` を足す。

- [ ] **Step 9: 通ることを確かめる** — Run: `pnpm vitest run packages/domain && pnpm type:check` / Expected: PASS。`CalculationResult` を組み立てている web のテストやフィクスチャで型が落ちたら、`capUsage: {}` を足す

- [ ] **Step 10: コミット**

```bash
git add packages/domain apps/web
git commit -m "上限のある特典の枠ごとに、使った分と残りを出す"
```

---

### Task 3: A. 上限までの残りの一覧

**Files:**
- Create: `apps/web/src/routes/-use-today.ts`（`(site)/-plan-list/plan-list.tsx` の `useToday` を移す。`plan-list.tsx` と `plan-list.browser.test.tsx` の import を直す）
- Create: `apps/web/src/routes/(plan)/-cap-lines.ts`
- Create: `apps/web/src/routes/(plan)/-plan-home/cap-list.tsx`
- Modify: `apps/web/src/routes/(plan)/-plan-home/plan-home.tsx`
- Test: `apps/web/src/routes/(plan)/-plan-home/cap-list.browser.test.tsx`（`summary-card.browser.test.tsx` の render と fixture の書き方に合わせる）

**Interfaces:**
- Consumes: `capLines`, `CapLine`, `priceToFill`, `TaxRate`（Task 2）
- Produces:
  - `useToday(now: () => Date): string | undefined`（場所だけ変わる）
  - `useCapLines(plan: Plan, day: string | undefined): CapLine[]`
  - `scopeText(line: CapLine, today: string | undefined): string` — 「このプラン」「期間中」「10月」「今日」「10/4」
  - `sharedText(line: CapLine, plans: Plan[]): string | undefined` — 「1回目と共有」
  - `yen(value: number): string` — 「¥12,100」（`-order-shared.tsx` に同じものがあればそれを使う）
  - `CapList({ plan, lines, today, taxRate, onTaxRate })`
  - `TAX_RATES: { value: TaxRate; label: string }[]`（10% / 8% / 非課税）

- [ ] **Step 1: `useToday` を移す**

`plan-list.tsx` の `useToday`（とそれだけが使う import）を `routes/-use-today.ts` に移し、`plan-list.tsx` と `plan-list.browser.test.tsx` はそこから import する。

Run: `pnpm --filter web exec vitest run --config vitest.browser.config.ts "src/routes/(site)/-plan-list"` / Expected: PASS（コマンドの形は `apps/web/package.json` の scripts に合わせる）

- [ ] **Step 2: 失敗する browser テストを書く**

fixture: 同じアカウントの 2 つのプラン。1 回目（`OTHER_PLAN`、名前「1回目」）に 10 月の注文があり、月間 100P・+1倍・`sharedKey` 付きの「楽天カード特典分」を使っている。2 回目（`PLAN`）は注文なし。2 回目のホームを開く。

```tsx
test("a cap shows what other plans used and the price that fills it", async () => {
  // 1回目: 3,300 yen at 10% → 30P of the card's 100P in October.
  const screen = await renderHome([second, first]);
  const caps = screen.getByRole("region", { name: "上限までの残り" });
  const row = caps.getByRole("listitem").filter({ hasText: "楽天カード特典分" });
  await expect.element(row).toHaveTextContent(/10月/);
  await expect.element(row).toHaveTextContent(/1回目と共有/);
  await expect.element(row).toHaveTextContent(/30 \/ 100P/);
  // 70P at +1: 7,000 yen excl. tax; at 10% the smallest price is 7,699 yen.
  await expect.element(row).toHaveTextContent(/あと¥7,699/);
  await caps.getByRole("radio", { name: "非課税" }).click();
  await expect.element(row).toHaveTextContent(/あと¥7,000/);
});

test("a cap that is used up says so", async () => {
  // 1回目: 11,000 yen → 100P, the whole cap.
  const screen = await renderHome([second, firstFull]);
  const row = screen
    .getByRole("region", { name: "上限までの残り" })
    .getByRole("listitem")
    .filter({ hasText: "楽天カード特典分" });
  await expect.element(row).toHaveTextContent(/上限/);
  await expect.element(row).not.toHaveTextContent(/あと¥/);
});

test("without a capped benefit there is no list", async () => {
  const screen = await renderHome([uncappedPlan]);
  await expect.element(screen.getByRole("region", { name: "上限までの残り" })).not.toBeInTheDocument();
});
```

（7,699 の根拠: 7,699 − ⌊7,699×10/110⌋ = 7,699 − 699 = 7,000。7,698 では 6,999。）

`SegmentedControl` の各項目の role は ctx7 の `/yamada-ui/yamada-ui` で確かめ、テストの `getByRole` をそれに合わせる。

- [ ] **Step 3: 失敗を確かめる** — Expected: FAIL（region がない）

- [ ] **Step 4: `-cap-lines.ts` を書く**

```ts
import { type CapLine, type Plan, type TaxRate, capLines } from "@workspaces/domain";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { withEffectiveAccount } from "../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../state/derived";

export const TAX_RATES: { value: TaxRate; label: string }[] = [
  { value: 0.1, label: "10%" },
  { value: 0.08, label: "8%" },
  { value: 0, label: "非課税" },
];

/** The plan's caps, with the account it is calculated with; a day cap is `day`'s. */
export function useCapLines(plan: Plan, day: string | undefined): CapLine[] {
  const result = useAtomValue(planResultAtom(plan.id));
  const settings = useAtomValue(accountSettingsAtom);
  return useMemo(
    () => (result ? capLines(withEffectiveAccount(plan, settings), result, day) : []),
    [plan, settings, result, day],
  );
}

/** 「10月」「期間中」: which cap the line is. */
export function scopeText(line: CapLine, today: string | undefined): string {
  switch (line.scope) {
    case "plan":
      return "このプラン";
    case "campaign":
      return "期間中";
    case "month":
      return `${Number(line.period?.slice(5, 7))}月`;
    case "day":
      return line.period === today
        ? "今日"
        : `${Number(line.period?.slice(5, 7))}/${Number(line.period?.slice(8, 10))}`;
  }
}

/** 「1回目と共有」, when other plans used the cap. */
export function sharedText(line: CapLine, plans: Plan[]): string | undefined {
  const names = line.sharedWith.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []);
  return names.length === 0 ? undefined : `${names.join("・")}と共有`;
}
```

- [ ] **Step 5: `cap-list.tsx` を書く**

部品を探す順: `List`（行）、`SegmentedControl`（税率）、`Progress`（ゲージ）、`Badge`（枠の名前）、`Text`。ゲージは「ほかのプランの分」と「このプランの分」を色で分ける。まず ctx7 で `Progress` に複数の区間を出す方法を探す。なければ、`Progress` を使わず `Box` の帯に 2 つの区間を並べ（`role="img"` と `aria-label="ほかのプラン 30P・このプラン 0P・上限 100P"`）、PR に「`Progress` は値が 1 つで、2 色に分けられない」と書く。

```tsx
import { type CapLine, type Plan, type TaxRate, priceToFill } from "@workspaces/domain";
import { Badge, Box, Flex, Heading, List, SegmentedControl, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { plansAtom } from "../../../state/queries";
import { TAX_RATES, scopeText, sharedText } from "../-cap-lines";
import { yen } from "../-order-shared";

const num = (value: number) => value.toLocaleString("ja-JP");

/** The price that fills the line's cap at `taxRate`; `null` when the rate is 0 now. */
export const fillPriceOf = (line: CapLine, taxRate: TaxRate) =>
  priceToFill(line.remaining, taxRate, line.rate, line.benefit.amountBasis);

function CapGauge({ line }: { line: CapLine }) {
  const share = (points: number) => `${line.cap === 0 ? 0 : Math.min(100, (points / line.cap) * 100)}%`;
  return (
    <Flex
      role="img"
      aria-label={`ほかのプラン ${num(line.usedElsewhere)}P・このプラン ${num(line.usedHere)}P・上限 ${num(line.cap)}P`}
      h="2"
      rounded="full"
      overflow="hidden"
      bg="bg.muted"
    >
      <Box w={share(line.usedElsewhere)} bg="gray.solid" />
      <Box w={share(line.usedHere)} bg="primary.solid" />
    </Flex>
  );
}

function CapRow({ line, today, taxRate, plans }: { line: CapLine; today: string | undefined; taxRate: TaxRate; plans: Plan[] }) {
  const price = fillPriceOf(line, taxRate);
  const shared = sharedText(line, plans);
  return (
    <List.Item display="flex" flexDirection="column" gap="1.5" py="2">
      <Flex align="center" gap="2" minW="0">
        <Text fontSize="sm" fontWeight="bold" lineClamp={1}>
          {line.benefit.label}
        </Text>
        <Badge size="sm" variant="subtle" colorScheme="gray">
          {scopeText(line, today)}
        </Badge>
        {shared ? (
          <Text as="span" fontSize="xs" color="fg.muted">
            {shared}
          </Text>
        ) : null}
      </Flex>
      <CapGauge line={line} />
      <Flex justify="space-between" fontSize="sm" fontVariantNumeric="tabular-nums">
        <Text as="span" color="fg.muted">
          {num(line.usedElsewhere + line.usedHere)} / {num(line.cap)}P
        </Text>
        <Text as="b">
          {line.remaining === 0 ? "上限" : price === null ? "—" : `あと${yen(price)}`}
        </Text>
      </Flex>
    </List.Item>
  );
}

/** 「上限までの残り」: every cap of the plan, and the tax-included price that fills it exactly. */
export function CapList({ lines, today, taxRate, onTaxRate }: {
  lines: CapLine[];
  today: string | undefined;
  taxRate: TaxRate;
  onTaxRate: (taxRate: TaxRate) => void;
}) {
  const plans = useAtomValue(plansAtom);
  return (
    <Flex direction="column" gap="2">
      <Flex justify="space-between" align="center" gap="2" wrap="wrap">
        <Heading as="h3" fontSize="sm">
          上限までの残り
        </Heading>
        <SegmentedControl.Root
          size="sm"
          aria-label="買う商品の税率"
          value={String(taxRate)}
          onChange={(value) => onTaxRate(Number(value) as TaxRate)}
          items={TAX_RATES.map(({ value, label }) => ({ value: String(value), label }))}
        />
      </Flex>
      <List.Root>
        {lines.map((line) => (
          <CapRow key={line.key + line.benefit.id} line={line} today={today} taxRate={taxRate} plans={plans} />
        ))}
      </List.Root>
      <Text fontSize="xs" color="fg.muted">
        選んだ税率の商品を 1 つ買って、上限をちょうど使い切る税込の金額です。マラソンはいまの店舗数の倍率で出しています。
      </Text>
    </Flex>
  );
}
```

`SegmentedControl` と `Badge`、`List` の props 名（`items`、`onChange` の型、`size`）は ctx7 で確かめて合わせる。

- [ ] **Step 6: `plan-home.tsx` に置く**

`Home` で:

```tsx
  const today = useToday(() => new Date());
  const [taxRate, setTaxRate] = useState<TaxRate>(0.1);
  const lines = useCapLines(plan, today);
  const capList =
    lines.length === 0 ? null : (
      <Card.Root as="section" id="caps" aria-label="上限までの残り">
        <Card.Body alignItems="stretch">
          <CapList lines={lines} today={today} taxRate={taxRate} onTaxRate={setTaxRate} />
        </Card.Body>
      </Card.Root>
    );
```

（`Panel` の `aria-label` だけでは `id` を付けられないので、`Panel` に `id?: string` を足して使ってもよい。）

- 広い画面: 右の列の `Warnings` の直後（ポイントの内訳より前）に `{wide ? capList : null}`
- スマホ: 注文のリストの後、シェアのボタンの前に `{wide ? null : capList}`。シェアのボタンを入れている `Box` の行を `gridRow="4"` に下げ、`capList` を `gridColumn="1" gridRow="3"` の `Box` に入れる

- [ ] **Step 7: 通ることを確かめる** — Run: `pnpm --filter web exec vitest run --config vitest.browser.config.ts "src/routes/(plan)/-plan-home"` / Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add apps/web/src/routes
git commit -m "プランのホームに、上限までの残りの一覧を出す"
```

---

### Task 4: C. 次に届く上限を 1 つ目立たせる

**Files:**
- Modify: `apps/web/src/routes/(plan)/-plan-home/summary-card.tsx`, `plan-home.tsx`
- Modify（テスト）: `apps/web/src/routes/(plan)/-plan-home/summary-card.browser.test.tsx`（174, 234, 331 行目付近の「上限まであと 約」「上限に達しました」の期待）

**Interfaces:**
- Consumes: `CapLine`, `TaxRate`, `fillPriceOf`（Task 3 の `cap-list.tsx`）, `scopeText`, `sharedText`, `yen`
- Produces: `nextCap(lines: CapLine[], taxRate: TaxRate): { line: CapLine; price: number } | undefined`（`summary-card.tsx` に置く）。`SummaryCard` の props に `lines: CapLine[]`, `today: string | undefined`, `taxRate: TaxRate`

- [ ] **Step 1: 失敗するテストに書き換える**

いまの「上限まであと 約21.3万円 買えます」の期待（174 行目）を、同じ fixture で C の文に置き換える。fixture のマラソンの上限 7,000P・いまの倍率から、ちょうど使い切る 10% の税込額を `priceToFill` で出して期待に使う:

```tsx
  // The marathon is the only cap: its fill price at 10% is what the summary shows.
  expect(summaryText()).toContain("次に上限に届くのは");
  expect(summaryText()).toContain("お買い物マラソン");
  expect(summaryText()).not.toContain("約");
```

331 行目（上限に届いたとき）は「上限のある特典は、すべて上限に届きました」に置き換える。234 行目（マラソンのないプランで「上限」が出ない）はそのまま。

加えて、2 つの上限のうち金額の少ないほうが出ることを確かめるテストを足す（Task 3 の 2 プランの fixture を流用し、楽天カード特典分の残り ¥7,699 がマラソンの残りより少ない状態）:

```tsx
test("the summary names the cap that the least money fills", async () => {
  const screen = await renderHome([second, first]);
  await expect
    .element(screen.getByRole("region", { name: "サマリー" }))
    .toHaveTextContent(/次に上限に届くのは楽天カード特典分 あと¥7,699（10月の枠・1回目と共有）/);
});
```

店舗数が足りずマラソンの倍率が 0 のときは、マラソンが C に出ないことも確かめる（倍率 0 の行は金額が `null`）。

- [ ] **Step 2: 失敗を確かめる** — Expected: FAIL

- [ ] **Step 3: 実装する**

`summary-card.tsx` から `Gauge` と、`remaining` を使う「上限まであと 約…」「上限に達しました」のブロックを消す（`currentRow` と `manYen` の import は、ほかで使わなければ消す）。代わりに:

```tsx
/** The cap the least money fills at `taxRate`; caps whose rate is 0 now cannot be filled. */
export function nextCap(lines: CapLine[], taxRate: TaxRate) {
  let next: { line: CapLine; price: number } | undefined;
  for (const line of lines) {
    if (line.remaining === 0) continue;
    const price = fillPriceOf(line, taxRate);
    if (price !== null && (next === undefined || price < next.price)) next = { line, price };
  }
  return next;
}

function NextCap({ lines, today, taxRate }: { lines: CapLine[]; today: string | undefined; taxRate: TaxRate }) {
  const plans = useAtomValue(plansAtom);
  if (lines.length === 0) return null;
  const next = nextCap(lines, taxRate);
  if (!next) {
    return lines.every((line) => line.remaining === 0) ? (
      <Text fontSize="sm" fontWeight="bold">上限のある特典は、すべて上限に届きました</Text>
    ) : null;
  }
  const shared = sharedText(next.line, plans);
  return (
    <Text fontSize="sm" bg="blackAlpha.400" rounded="lg" px="2.5" py="2">
      次に上限に届くのは<Text as="b">{next.line.benefit.label}</Text> あと
      <Text as="b" fontVariantNumeric="tabular-nums">{yen(next.price)}</Text>
      <Text as="span" color="primary.contrast/80">
        （{scopeText(next.line, today)}の枠{shared ? `・${shared}` : ""}）
      </Text>{" "}
      <Link href="#caps" color="inherit" textDecoration="underline">すべて見る</Link>
    </Text>
  );
}
```

`SummaryCard` に `lines`, `today`, `taxRate` を足し、消したブロックの場所に `<NextCap … />` を置く。`Link` は `@workspaces/ui` のもの（同じページ内のアンカーなので `RouterLink` ではない）。`plan-home.tsx` から渡す。

- [ ] **Step 4: 通ることを確かめる** — Run: Task 3 Step 7 と同じ / Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/web/src/routes
git commit -m "サマリーに、次に上限に届く特典とその金額を出す"
```

---

### Task 5: B. 追加フォームで、打った金額の行き先を見せる

**Files:**
- Create: `packages/domain/src/calculate/cap-flows.ts`, `packages/domain/src/calculate/cap-flows.test.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `apps/web/src/routes/(plan)/-cap-flows.tsx`, `apps/web/src/routes/(plan)/-cap-flows.browser.test.tsx`
- Modify: `apps/web/src/routes/(plan)/-plan-home/order-add-form.tsx`, `apps/web/src/routes/(plan)/-order-editor/order-editor.tsx`

**Interfaces:**
- Consumes: `CapLine`, `capLines`, `priceToFill`, `useCapLines`, `scopeText`, `yen`, `draftOfInput`, `useFormInput`, `AMOUNT_PATH`
- Produces:
  - `type CapFlow = { line: CapLine; points: number; into: number; over: number; fillPrice: number | null }`
  - `capFlows(input: { lines: CapLine[]; order: Order; shop: Shop | undefined }): CapFlow[]`
  - `CapFlows({ plan, form }: { plan: Plan; form: OrderForm })`

- [ ] **Step 1: domain の失敗するテストを書く**（`cap-flows.test.ts`。`cap-lines.test.ts` の `card` と同じ形の特典で `CapLine` を直接組み立てる）

```ts
const line = (over: Partial<CapLine> = {}): CapLine => ({
  benefit: card, key: "month:default:card:2026-10", scope: "month", period: "2026-10",
  cap: 100, usedHere: 0, usedElsewhere: 30, sharedWith: [], remaining: 70, rate: 1, ...over,
});

test("points into the cap and over it, and the price that fills it", () => {
  // 11,000 yen at 10% → 10,000 excl. → 100P: 70P fit, 30P are over.
  const [flow] = capFlows({ lines: [line()], order: order("2026-10-05", 11000, 0.1), shop });
  expect(flow).toMatchObject({ points: 100, into: 70, over: 30, fillPrice: 7699 });
});

test("a line of another month, or whose conditions the order misses, takes nothing", () => {
  expect(capFlows({ lines: [line({ period: "2026-11" })], order: order("2026-10-05", 11000, 0.1), shop })).toEqual([]);
  const only39 = line({ benefit: { ...card, conditions: { shopTags: ["39shop"] } } });
  expect(capFlows({ lines: [only39], order: order("2026-10-05", 11000, 0.1), shop })).toEqual([]);
});

test("a shop-around cap takes nothing from a channel that does not receive it", () => {
  const rakuma: Shop = { ...shop, channel: "rakuma" };
  expect(capFlows({ lines: [line({ benefit: marathon, scope: "plan", period: null })], order: order("2026-10-05", 11000, 0.1), shop: rakuma })).toEqual([]);
});

test("an order of several items has no fill price", () => {
  const two = { ...order("2026-10-05", 1100, 0.1), lineItems: [...order("2026-10-05", 1100, 0.1).lineItems, { ...order("2026-10-05", 1100, 0.1).lineItems[0], id: "x0000000-0000-4000-8000-000000000001" }] };
  expect(capFlows({ lines: [line()], order: two, shop })[0]?.fillPrice).toBeNull();
});
```

（`order(date, price, taxRate)` は 1 品の注文を返す小さな helper としてファイルに書く。`marathon` は `cap-lines.test.ts` と同じもの。）

- [ ] **Step 2: 失敗を確かめる** — Expected: FAIL

- [ ] **Step 3: `cap-flows.ts` を書く**

```ts
import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import { benefitKinds, pointsFor } from "../benefit-kinds";
import { channels } from "../channels";
import { matchesConditions } from "../conditions/matches";
import type { Order } from "../model/order";
import type { Shop } from "../model/shop";
import type { CapLine } from "./cap-lines";
import { priceToFill } from "./fill-price";

/** Where the points of an order not yet added go in one cap. */
export type CapFlow = {
  line: CapLine;
  /** Points the order earns from the line's benefit, before the cap. */
  points: number;
  /** The part of `points` the cap still has room for. */
  into: number;
  /** The part of `points` beyond the cap. */
  over: number;
  /** The price of the order's one item that fills the cap exactly; `null` with several items or a discount. */
  fillPrice: number | null;
};

/**
 * For each cap the order's points go into, how much fits and how much is over. `lines` must be
 * `capLines` for the order's date, without the order. The rate is the plan's now.
 */
export function capFlows(input: { lines: CapLine[]; order: Order; shop: Shop | undefined }): CapFlow[] {
  const { lines, order, shop } = input;
  const context = {
    channel: shop?.channel ?? null,
    shopTags: shop?.tags ?? null,
    shopId: order.shopId,
    date: order.date,
    orderTaxIncluded: order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0),
    orderTags: order.tags,
  };
  const receives = context.channel !== null && channels[context.channel].receivesShopAround;
  const [only, ...rest] = order.lineItems;
  const single = only && rest.length === 0 && only.quantity === 1 && only.discount === 0 ? only : undefined;
  return lines.flatMap((line): CapFlow[] => {
    const { benefit } = line;
    if (line.period !== null && !order.date.startsWith(line.period)) return [];
    if (benefitKinds[benefit.kind].onlyReceivingChannels && !receives) return [];
    if (!matchesConditions(benefit.conditions, context)) return [];
    const items = order.lineItems.map((item) => ({
      lineItemId: item.id,
      orderId: order.id,
      amount: benefit.amountBasis === "tax-included" ? taxIncludedTarget(item) : taxExcludedTarget(item),
    }));
    const earned = pointsFor(items, line.rate, benefit.params.roundingUnit);
    const points = [...earned.values()].reduce((sum, value) => sum + value, 0);
    if (points === 0) return [];
    const into = Math.min(points, line.remaining);
    const fillPrice =
      single && line.remaining > 0
        ? priceToFill(line.remaining, single.taxRate, line.rate, benefit.amountBasis)
        : null;
    return [{ line, points, into, over: points - into, fillPrice }];
  });
}
```

`index.ts` に `export { capFlows, type CapFlow } from "./calculate/cap-flows";` を足す。

- [ ] **Step 4: 通ることを確かめる** — Run: `pnpm vitest run packages/domain` / Expected: PASS

- [ ] **Step 5: web の失敗するテストを書く**（`-cap-flows.browser.test.tsx`。`order-editor.browser.test.tsx` か `order-table.browser.test.tsx` の、追加フォームを開く書き方に合わせる。fixture は Task 3 の 2 プラン）

```tsx
test("the amount typed shows where its points go, and a button fills the cap", async () => {
  const screen = await renderHome([second, first]); // 2回目: 10月のカードの枠が残り 70P
  const form = await openAddForm(screen); // ショップを選ぶまで
  await form.getByRole("textbox", { name: "金額（税込）" }).fill("11000");
  const flows = form.getByRole("list", { name: "上限への入り方" });
  await expect.element(flows).toHaveTextContent(/楽天カード特典分.*\+70P.*30P はみ出す/);
  await flows.getByRole("button", { name: "¥7,699 で使い切る" }).click();
  await expect.element(form.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("7699");
});

test("nothing is shown until an amount is typed", async () => {
  const screen = await renderHome([second, first]);
  const form = await openAddForm(screen);
  await expect.element(form.getByRole("list", { name: "上限への入り方" })).not.toBeInTheDocument();
});
```

- [ ] **Step 6: 失敗を確かめる** — Expected: FAIL

- [ ] **Step 7: `-cap-flows.tsx` を書く**

```tsx
// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { setInput } from "@formisch/react";
import { type Plan, capFlows } from "@workspaces/domain";
import { Button, Flex, List, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useDeferredValue, useMemo } from "react";
import { shopsAtom } from "../../state/queries";
import { useCapLines, scopeText } from "./-cap-lines";
import { draftOfInput } from "./-order-editor/order-form";
import { AMOUNT_PATH, type OrderForm, useFormInput } from "./-order-editor/order-form-store";
import { yen } from "./-order-shared";

const num = (value: number) => value.toLocaleString("ja-JP");

/**
 * Under a new order's amount: how many of its points each cap still takes, and how many are over,
 * with a button that types the price filling the cap. Nothing while the order is not valid, held,
 * or goes into no cap.
 */
export function CapFlows({ plan, form }: { plan: Plan; form: OrderForm }) {
  const shops = useAtomValue(shopsAtom);
  const input = useFormInput(form);
  const deferred = useDeferredValue(JSON.stringify(input));
  const draft = useMemo(() => draftOfInput(JSON.parse(deferred), shops, undefined), [deferred, shops]);
  const lines = useCapLines(plan, draft?.order.date);
  const flows = useMemo(() => {
    if (!draft || draft.order.onHold) return [];
    const shop = draft.shop ?? shops.find((other) => other.id === draft.order.shopId);
    return capFlows({ lines, order: draft.order, shop });
  }, [draft, lines, shops]);
  if (flows.length === 0) return null;
  return (
    <List.Root aria-label="上限への入り方" w="full" fontSize="xs" gap="1">
      {flows.map(({ line, into, over, fillPrice }) => (
        <List.Item key={line.key + line.benefit.id} display="flex" alignItems="center" gap="2" flexWrap="wrap">
          <Text as="span">
            {line.benefit.label}（{scopeText(line, undefined)}）{" "}
            <Text as="b" fontVariantNumeric="tabular-nums">+{num(into)}P</Text>
            {over > 0 ? (
              <Text as="span" color="fg.muted">・{num(over)}P はみ出す</Text>
            ) : null}
          </Text>
          {fillPrice !== null && fillPrice > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setInput(form, { path: AMOUNT_PATH, input: String(fillPrice) })}
            >
              {yen(fillPrice)} で使い切る
            </Button>
          ) : null}
        </List.Item>
      ))}
    </List.Root>
  );
}
```

日の枠の名前は `scopeText(line, undefined)` だと「10/5」になる（下書きの日付の枠なので、それでよい）。`useFormInput` が返すものと `draftOfInput` の引数の形は、`order-add-form.tsx` の `Preview` と同じ。

- [ ] **Step 8: 置く**

- `order-add-form.tsx`: タグと `Preview` の `Flex` の直後（同じ `Flex direction="column"` の中）に `<CapFlows plan={plan} form={form} />`
- `order-editor.tsx`: `EditorContent` で `Preview` を描いているところの直後に、`original` がないとき（新しい注文）だけ `<CapFlows plan={plan} form={form} />`

- [ ] **Step 9: 通ることを確かめる** — Run: `pnpm vitest run packages/domain` と `-cap-flows` / `-order-editor` / `-plan-home` の browser テスト / Expected: PASS

- [ ] **Step 10: コミット**

```bash
git add packages/domain apps/web/src/routes
git commit -m "注文の追加フォームで、打った金額が上限にいくら入るかを見せる"
```

---

### Task 6: 全体の確認と PR

- [ ] **Step 1:** `pnpm check:all` を通す（lint・fmt・型・cspell・vitest）。cspell が新しい語で落ちたら `cspell.json` の words に足す
- [ ] **Step 2:** browser テストを通す（`apps/web/package.json` の browser テストの script）
- [ ] **Step 3:** `pnpm test:e2e` を通す。4173 番ポートが使われていたら、止めずに空くのを待ってからやり直す
- [ ] **Step 4:** `pnpm dev` で開き、スマホ幅と PC 幅で A・B・C を目で確かめる（確かめるのはユーザー。ここでは崩れていないかだけ見る）
- [ ] **Step 5:** push して、`.github/pull_request_template.md` の節で日本語の PR を出す。`Closes #116`。レビュー観点に `[プランの一覧](/)` と、プランのホームの確かめ方（プランを作ってから `/plan?id=…` を開く。Preview では保存先がブラウザーなので、プランは自分で作る）を書く。`Box` で組んだゲージについて、探した部品（`Progress`）と使わなかった理由を書く
- [ ] **Step 6:** CI と Preview のジョブを待ち、レビュー観点のリンクが 200 を返すことを `curl -o /dev/null -w "%{http_code}"` で確かめる。マージはしない
