# 計画1c: ドメインの追加（非課税・保留・リピート・コピーと並べ替え・画面用の計算） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI デザインの確定で増えた仕様（非課税、保留、注文の属性とリピート購入、内訳の4区分、利用者が自分で作れるテンプレート、注文のコピーと並べ替え、保留中の注文の参考ポイント、買いまわりの見通し）を `@workspaces/domain` に入れる。

**Architecture:** 計画1・1b の `@workspaces/domain` を拡張する。モデルに項目を足し、計算エンジンは保留中の注文を外して計算する。画面用の計算（`heldEstimates`、`shopAroundOutlook`、区分ごとの合計）は `calculateAll` の結果に足す。注文の操作は純粋関数にする。

**Tech Stack:** 計画1と同じ。

**Spec:** `docs/superpowers/specs/2026-10-04-rebuild-design.md`（2節、3節「画面のための計算結果」）。用語は `docs/glossary.md`。

## Global Constraints

- 計画1・1b の Global Constraints をすべて引き継ぐ（`docs/superpowers/plans/2026-10-04-plan1-verification-and-domain.md`、`2026-10-04-plan1b-shared-caps-and-campaigns.md`）。
- 保存データはまだないので、マイグレーションは書かない。新しい項目には既定値を持たせる（`onHold: false`、`tags: []`）。
- 計画1・1b の既存のテストは、型のために必要なフィールドの追加以外は変えずに通すこと。
- 用語は「コピー」。「複製」「duplicate」は識別子にも文言にも使わない（関数名は `copyOrder`）。

## Review Focus

1. **保留中の注文だけのショップ:** そのショップはショップ数に数えず、上限の計算にも入らない（Task 2）。
2. **非課税の商品:** 税込と税抜の対象額が同じになり、ポイントはその額で計算される（Task 1）。
3. **保留を外したときの参考ポイント:** 上限に達している特典があるとき、参考ポイントは上限で削られた後の増分になる（Task 2）。
4. **買いまわりの見通しが10店舗を超える:** 10店舗以上では行を増やさず、`nextShop` は `null`（Task 2）。
5. **コピーした注文:** 注文と商品の ID がすべて新しく、元の注文の直後に入り、ほかの注文の順番は変わらない（Task 4）。

---

### Task 1: モデルの追加

**Files:**
- Modify: `packages/domain/src/model/common.ts`, `model/order.ts`, `benefit-kinds/index.ts`, `amounts/target-amount.ts`, `conditions/matches.ts`, `calculate/calculate.ts`（`ConditionContext` に `orderTags` を渡すだけ）, `index.ts`
- Test: 既存のテストファイルに追加

**Interfaces:**
- `LineItemSchema.taxRate` を `v.picklist([0.1, 0.08, 0])` にする。`taxExcludedTarget` は税率 0 のとき税込の対象額をそのまま返す。
- `OrderTagSchema = v.picklist(["repeat"])`、`type OrderTag`。
- `OrderSchema` に `onHold: v.optional(v.boolean(), false)` と `tags: v.optional(v.array(OrderTagSchema), [])` を足す。
- `ConditionsSchema` に `orderTags?: OrderTag[]` を足す。`ConditionContext` に `orderTags: OrderTag[]` を足し、`matchesConditions` は `orderTags` が指定されていれば、注文がそのすべてを持つときだけ満たす。
- `BenefitSchema` の `category` を `v.picklist(["base", "spu", "campaign"])` にする。

- [ ] **Step 1: 失敗するテストを書く**
  - `test("tax-exempt item has equal included and excluded targets")`: `unitPrice: 1000, taxRate: 0` → 税込・税抜とも `1000`。
  - `test("order defaults onHold false and tags empty")`
  - `test("orderTags requires every tag")`: `orderTags: ["repeat"]` に対して `ctx.orderTags = ["repeat"]` は `true`、`[]` は `false`。
  - `test("benefit category accepts base")`
- [ ] **Step 2: 失敗を確かめる**（Run: `pnpm vitest run packages/domain/src` → FAIL）
- [ ] **Step 3: 実装し、新しいスキーマと型を公開する**
- [ ] **Step 4: `pnpm check:all` が通ることを確かめる**
- [ ] **Step 5: Commit** `git commit -m "feat(domain): add tax-exempt rate, order hold, order tags and base category"`

---

### Task 2: 保留の除外と画面用の計算結果

**Files:**
- Modify: `packages/domain/src/calculate/calculate.ts`, `calculate/types.ts`, `calculate/shop-count.ts`, `index.ts`
- Create: `packages/domain/src/calculate/outlook.ts`, `packages/domain/src/calculate/point-group.ts`
- Test: `packages/domain/src/calculate/hold.test.ts`, `outlook.test.ts`, `point-group.test.ts`

**Interfaces:**
- `onHold: true` の注文は、ショップ数、特典、ショップ倍率、上限のすべてから外す。期間外や台帳にないショップの警告も出さない。
- `type PointGroup = "base" | "spu" | "marathon" | "campaign"`。`pointGroupOf(source: Benefit | "shop-rate"): PointGroup`: `"shop-rate"` と `category: "campaign"` で `kind` が `shop-around` でないものは `campaign`、`kind: "shop-around"` は `marathon`、`category: "base"` は `base`、`category: "spu"` は `spu`。
- `CalculationResult` に次を足す。
  - `groupTotals: Record<PointGroup, number>`（内訳の行をこの区分で合計したもの。和は `total` と一致する）
  - `heldEstimates: { orderId: string; points: number }[]`: 保留中の注文ごとに、その注文の `onHold` だけを `false` にした全プランを計算し直し、全プランの `total` の和の増分を入れる（上限を共有するプランの間でポイントが移るだけの分を数えないため）。
  - `shopAroundOutlook: ShopAroundOutlook | null`（`outlook.ts`）: そのプランで有効な最初の `shop-around` の特典について求める。なければ `null`。
    ```ts
    type ShopAroundOutlook = {
      benefitId: string;
      shopCount: number;
      currentRate: number;            // 段階から求めた現在の倍率
      receivingBase: number;          // 買いまわりの対象になる商品の対象額の合計（特典の amountBasis による）
      cap: number | null;             // 上限のグループの上限（食い違うときは最小）− グループのほかの対象の生のポイント（0 未満は 0）。上限がなければ null
      rows: { shops: number; rate: number; remainingTaxExcluded: number | null; remainingTaxIncludedApprox: number | null }[];
      nextShop: { rateDelta: number; pointsGain: number } | null;
    };
    ```
    - `rows` は `max(shopCount, 1)` から、段階の最大の `minShops` までの各ショップ数（10店舗の段階が最大なら10まで）。`rate` はそのショップ数の段階の倍率。
    - `remainingTaxExcluded` は上限に達するまでに買える残りの対象額。`cap` がないか `rate` が 0 なら `null`。それ以外は `max(0, ceil(cap × 100 / rate) − receivingBase)`。`remainingTaxIncludedApprox` は `floor(remainingTaxExcluded × 1.1)`。特典の `amountBasis` が `"tax-included"` のときは換算せず `remainingTaxExcluded` と同じ値にする。
    - `rows` は、`shopCount` が最大の段階を超えるときも最大の段階の1行だけにする。
    - `nextShop` は「あと1店舗」の値で、`shopCount + 1` の段階の倍率を「次の倍率」とする。次の倍率が現在の倍率と同じ（最大の段階にいる、または1店舗増やしても次の段階に届かない）とき `null`。それ以外は `rateDelta` = 次の倍率 − 現在の倍率、`pointsGain` = `min(cap, floor(receivingBase × 次の倍率 / 100)) − min(cap, floor(receivingBase × 現在の倍率 / 100))`（`cap` がなければ `min` を取らない）。倍率の計算は計画1の Global Constraints の整数の方法に従う。

- [ ] **Step 1: 失敗するテストを書く**
  - `hold.test.ts`:
    - `test("held order is excluded from shop count and totals")`: 1,100円の注文 A（ショップ1）と 1,100円の保留中の注文 B（ショップ2）→ `shopCount: 1`、B の行が内訳にない。
    - `test("held estimate is the total increase when unheld")`: 上の例で、B の `heldEstimates` が、B を保留しなかった場合の `total` との差に等しい。
    - `test("held estimate respects caps")`: 上限ちょうどに達している特典があるとき、参考ポイントにその特典の増分が入らない。
  - `point-group.test.ts`: `test("maps sources to groups")`、`test("group totals sum to total")`
  - `outlook.test.ts`（段階 2→+1 … 10→+9、上限 7,000、対象の税抜合計 10,200円、4店舗）:
    - `test("rows from current shop count to ten")`: `rows[0]` が `{ shops: 4, rate: 3 }`、最後が `{ shops: 10, rate: 9 }`。
    - `test("remaining amount until cap")`: 4店舗の行の `remainingTaxExcluded` が `ceil(700000 / 3) − 10200 = 223134`。
    - `test("next shop gain")`: `nextShop` が `{ rateDelta: 1, pointsGain: 102 }`。
    - `test("no next shop at top tier")`: 10店舗で `nextShop` が `null`。
    - `test("null when no shop-around benefit")`
- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `pnpm check:all` が通ることを確かめる**
- [ ] **Step 5: Commit** `git commit -m "feat(domain): exclude held orders and add estimates, outlook and group totals"`

---

### Task 3: テンプレートとプラン作成

**Files:**
- Modify: `packages/domain/src/master/spu.ts`, `master/campaigns.ts`, `master/instantiate.ts`, `master/create-plan.ts`, 各テスト, `index.ts`

**Interfaces:**
- `standardSpu` の「通常ポイント」と「楽天カード通常分」を `category: "base"` にする。
- `campaignTemplates` に次を足す（`category: "campaign"`、ID は UUID の直書き）。
  - リピート購入: `occurrence: "user-period"`、`rate-bonus`、`rate: 1`、`minOrderAmount: 3980`、`orderTags: ["repeat"]`、`capScope: "campaign"`、`sharedKey: "repeat"`、`cap` なし（開催ごとに利用者が入れる）。出典として https://appllio.com/rakuten-repeat-purchase をコメントに書き、不定期のキャンペーンで条件が開催ごとに違うことを書く。
  - 買いまわり（手動）: `occurrence: "user-period"`、`shop-around`、段階 2→+1 … 10→+9、`cap: 7000`、`capScope: "campaign"`、`sharedKey: "shop-around"`。プリセットのない回のマラソンやスーパーSALE に使う。
  - 自由な倍率: `occurrence: "user-period"`、`rate-bonus`、`rate: 1`、`cap` なし、`capScope: "plan"`、`sharedKey` なし。
- `instantiateCampaign(template, input)` の `input` に `cap?: number`、`minOrderAmount?: number`、`label?: string` を足し、指定されたものでテンプレートの値を上書きする。`user-dates` と `user-period` の特典は `enabled: true` で作る（利用者が参加した日や期間を入れたため）。`sharedKey` を持たないテンプレートの `user-period` では `sharedKey` を付けない。
- `createPlan(input: { id; name; event?; profile; now; newId: () => Id })`: `occurrence: "fixed"` のテンプレート（5と0のつく日）を `instantiateCampaign` で特典にし、`enabled: false` のまま `benefits` の末尾に足す。
- `hasCampaignOccurrence(plan: Plan, template: CampaignTemplate, input: { dates?: IsoDate[]; period?: Period }): boolean`: `fixed` は同じ `sharedKey` の特典があるとき、`user-period` は `sharedKey` が `<テンプレートの sharedKey>:<period.start>` と同じ特典があるとき、`user-dates` は `sharedKey` が同じで日付が1つでも重なる特典があるとき `true`。`sharedKey` を持たないテンプレートは常に `false`（何度でも足せる）。

- [ ] **Step 1: 失敗するテストを書く**
  - `test("base points and card normal are in the base category")`
  - `test("repeat template targets repeat orders over 3,980 yen")`: インスタンス化した特典が、`tags: ["repeat"]` で 3,980円以上の注文だけを対象にする（`calculateAll` で確かめる）。
  - `test("manual shop-around template can be instantiated with a custom cap")`
  - `test("instantiate overrides cap, minOrderAmount and label")`
  - `test("user-dates and user-period instances are enabled")`
  - `test("createPlan adds fixed campaigns disabled")`
  - `test("hasCampaignOccurrence detects same period")`、`test("hasCampaignOccurrence detects overlapping dates")`、`test("templates without sharedKey can be added repeatedly")`
- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: 実装する。既存の `createPlan` のテストは `newId` を渡すように直す**
- [ ] **Step 4: `pnpm check:all` が通ることを確かめる**
- [ ] **Step 5: Commit** `git commit -m "feat(domain): add repeat, manual shop-around and custom templates"`

---

### Task 4: 注文のコピーと並べ替え

**Files:**
- Create: `packages/domain/src/plan-ops/order-ops.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/plan-ops/order-ops.test.ts`

**Interfaces:**
- `copyOrder(plan: Plan, orderId: string, newId: () => Id): Plan`: 指定の注文と、その中の商品の ID をすべて `newId()` で新しくした注文を、元の注文の直後に入れたプランを返す。`plan` は変更しない。見つからなければ例外。
- `moveOrder(plan: Plan, orderId: string, toIndex: number): Plan`: 注文を `toIndex`（0 から、範囲外は端に丸める）に移したプランを返す。`plan` は変更しない。見つからなければ例外。

- [ ] **Step 1: 失敗するテストを書く**
  - `test("copy inserts right after the original with new ids")`
  - `test("copy keeps other orders in place")`
  - `test("copy does not mutate the plan")`
  - `test("move to index")`、`test("move clamps out-of-range index")`
  - `test("unknown order throws")`
- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `pnpm check:all` が通ることを確かめる**
- [ ] **Step 5: Commit** `git commit -m "feat(domain): add order copy and move operations"`
