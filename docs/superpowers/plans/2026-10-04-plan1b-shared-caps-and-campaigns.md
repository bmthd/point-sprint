# 計画1b: 上限の共有範囲と定例キャンペーン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 特典に対象額の基準（税込・税抜）と上限の共有範囲を持たせ、全プランをまとめて計算する `calculateAll` を作り、楽天カードの2つの還元と定例キャンペーン（5と0のつく日、勝ったら倍、39ショップ）をマスタデータに入れる。

**Architecture:** 計画1で作った `@workspaces/domain` を拡張する。特典の共通フィールドに `amountBasis`、`capScope`、`sharedKey` を足し、計算エンジンは特典をグループ（上限をかける単位）にまとめてから上限をかける。`calculate(plan, shops)` は `calculateAll([plan], shops)` の1件として残す。

**Tech Stack:** 計画1と同じ（Valibot 1.5.0、Vitest 5.0.3 ほか）

**Spec:** `docs/superpowers/specs/2026-10-04-rebuild-design.md`（2節の Benefit・Shop・Conditions・DateRule・CampaignTemplate、3節「計算が従う楽天の規則」「上限の共有範囲」「計算の手順」）。用語は `docs/glossary.md`。

## Global Constraints

- 計画1の Global Constraints（`docs/superpowers/plans/2026-10-04-plan1-verification-and-domain.md`）をすべて引き継ぐ。
- 保存データはまだ存在しない（画面と保存は計画2で作る）ので、スキーマの変更にマイグレーションは書かない。`CURRENT_SCHEMA_VERSION` は 1 のまま。
- 新しいフィールドはすべて既定値を持たせ、既存のテストデータとマスタデータが書き換えなしでも検証を通るようにする（`amountBasis` の既定は `"tax-excluded"`、`capScope` の既定は `"plan"`、`Shop.tags` の既定は `[]`）。
- 上限のグループのキーは次の文字列とする。`plan`: `plan:<planId>:<benefitId>`、`campaign`: `campaign:<sharedKey ?? benefitId>`、`month`: `month:<sharedKey ?? benefitId>:<注文日の YYYY-MM>`、`day`: `day:<sharedKey ?? benefitId>:<注文日>`。

## Review Focus

1. **同じ月の2つのプランが同じ月間上限の特典を持つ:** 上限は2つのプランの合計にかかり、プランごとの内訳の和が上限と一致する（Task 2）。
2. **ユーザーが片方のプランだけ上限を書き換えた:** 小さい方の上限を使い、`shared-cap-mismatch` の警告を出す（Task 2）。
3. **月をまたぐプラン:** 月間上限は注文日の月ごとに別々にかかる（Task 2）。
4. **ショップ台帳にない注文と `shopTags`:** 属性を判定できないので、`shopTags` を指定した特典の対象にならない（Task 1）。
5. **楽天カード通常分:** 税込 3,300円の注文で 33ポイント（税抜なら 30）になり、上限はかからない（Task 2、Task 3）。

---

## File Structure

```
packages/domain/src/
  model/common.ts            ShopTag、DateRule の dates、Conditions の shopTags
  model/shop.ts              Shop.tags
  model/campaign-template.ts CampaignTemplate（新規）
  benefit-kinds/index.ts     Benefit の共通フィールド amountBasis、capScope、sharedKey
  benefit-kinds/types.ts     EligibleItem.taxExcluded → amount
  benefit-kinds/points.ts    amount を使う
  conditions/matches.ts      dates と shopTags の判定
  calculate/types.ts         shared-cap-mismatch の警告
  calculate/cap-groups.ts    グループのキーと上限の解決（新規）
  calculate/calculate.ts     calculateAll と calculate
  master/spu.ts              楽天カードの2分割、SPU の capScope
  master/events.ts           マラソンの capScope
  master/campaigns.ts        定例キャンペーンのテンプレート（新規）
  master/instantiate.ts      テンプレートから特典を作る（新規）
```

---

### Task 1: モデルと適用条件の拡張

**Files:**
- Modify: `packages/domain/src/model/common.ts`, `model/shop.ts`, `benefit-kinds/index.ts`, `conditions/matches.ts`, `calculate/calculate.ts`（`ConditionContext` に `shopTags` を渡すだけ）
- Create: `packages/domain/src/model/campaign-template.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `model/plan.test.ts`, `model/order.test.ts` か新しい `model/benefit.test.ts`, `conditions/matches.test.ts`

**Interfaces:**
- Produces:
  - `ShopTagSchema = v.picklist(["39shop"])`、`type ShopTag`
  - `DateRuleSchema` に `{ type: "dates", dates: IsoDate[]（1件以上） }` を追加
  - `ConditionsSchema` に `shopTags?: ShopTag[]` を追加
  - `ShopSchema` に `tags: v.optional(v.array(ShopTagSchema), [])` を追加
  - `BenefitSchema` の全種類に共通で `amountBasis: v.optional(v.picklist(["tax-excluded", "tax-included"]), "tax-excluded")`、`capScope: v.optional(v.picklist(["plan", "campaign", "month", "day"]), "plan")`、`sharedKey: v.optional(v.pipe(v.string(), v.minLength(1)))` を追加（`benefitEntry` に足す）
  - `CampaignTemplateSchema = v.object({ id: v.string(), name: v.string(), occurrence: v.picklist(["fixed", "user-dates", "user-period"]), benefit: BenefitSchema })`、`type CampaignTemplate`
  - `ConditionContext` に `shopTags: ShopTag[] | null`（台帳にないショップは `null`）を追加。`matchesConditions` は、`shopTags` が指定されていれば、`ctx.shopTags` が `null` でなく指定の属性をすべて含むときだけ満たす。`dates` は `ctx.date` が `dates` に含まれるときだけ満たす。
  - `calculate.ts` は `ConditionContext` を作るところで、ショップの `tags`（台帳になければ `null`）を渡す。それ以外の計算は変えない。

- [ ] **Step 1: 失敗するテストを書く**
  - `test("benefit defaults amountBasis and capScope")`: `amountBasis` と `capScope` を省いた特典を `v.parse(BenefitSchema, …)` すると `"tax-excluded"` と `"plan"` になる。
  - `test("shop tags default to empty")`: `tags` を省いたショップが `[]` になる。
  - `test("rejects unknown shop tag")`: `tags: ["50shop"]` は失敗する。
  - `test("dates rule matches listed dates only")`: `{ type: "dates", dates: ["2026-10-04"] }` に対して `2026-10-04` は `true`、`2026-10-05` は `false`。
  - `test("shopTags requires every tag")`: `shopTags: ["39shop"]` に対して `ctx.shopTags = ["39shop"]` は `true`、`[]` は `false`。
  - `test("shopTags fails for unknown shop")`: `ctx.shopTags = null` は `false`。
- [ ] **Step 2: テストが失敗することを確かめる**
  Run: `pnpm vitest run packages/domain/src/model packages/domain/src/conditions`
  Expected: FAIL
- [ ] **Step 3: Interfaces どおりに実装し、新しいスキーマと型を `index.ts` から公開する**
- [ ] **Step 4: 全テストが通ることを確かめる**
  Run: `pnpm check:all`
  Expected: すべて成功（既存の計算エンジンのテストも変更なしで通る）
- [ ] **Step 5: Commit**
  `git commit -m "feat(domain): add amount basis, cap scope, shop tags and date lists"`

---

### Task 2: 全プランをまとめて計算する `calculateAll`

**Files:**
- Modify: `packages/domain/src/benefit-kinds/types.ts`, `benefit-kinds/points.ts`（`EligibleItem.taxExcluded` を `amount` に改名）、関連するテスト
- Create: `packages/domain/src/calculate/cap-groups.ts`
- Modify: `packages/domain/src/calculate/calculate.ts`, `calculate/types.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/src/calculate/cap-groups.test.ts`, `packages/domain/src/calculate/calculate-all.test.ts`

**Interfaces:**
- Consumes: Task 1 の `Benefit.amountBasis`、`capScope`、`sharedKey`
- Produces:
  - `EligibleItem = { lineItemId: string; orderId: string; amount: number }`（`amount` は特典の `amountBasis` に応じた対象額。`pointsFor` は `amount` で計算し、注文単位の按分の重みも `amount` にする）
  - `capGroupKey(planId: string, benefit: Benefit, orderDate: string): string`（Global Constraints のキーの形式）
  - `CalculationWarning` に `{ type: "shared-cap-mismatch"; groupKey: string }` を追加
  - `calculateAll(plans: Plan[], shops: Shop[]): Map<string, CalculationResult>`（キーはプラン ID。入力の全プランについて結果を返す）
  - `calculate(plan: Plan, shops: Shop[]): CalculationResult` = `calculateAll([plan], shops).get(plan.id)`

処理は設計書3節「上限の共有範囲」と「計算の手順」に従う。このタスクで決める点は次のとおり。
- 生のポイントは、計画1と同じくプランごとに特典の種類で求める（ショップ数はプランごと）。そのあと、商品ごとの生のポイントを、注文日から求めたグループのキーで振り分ける。1つの特典の商品が複数のグループに分かれることがある（月をまたぐ、日が違う）。
- グループの上限は、そのグループに属する特典（プランごとの複製）の `params.cap` の最小値とする。上限を持つものと持たないものが混ざる、または値が異なるときは `shared-cap-mismatch` を1回だけ出す。警告はグループに属する全プランの結果に入れる。
- 上限で削るときは、グループ内の商品を `(planId, lineItemId)` の昇順に並べ、生のポイントを重みに `largestRemainder` で配る。
- `BenefitTotal` はプランごとに、その特典の `rawPoints`（そのプランの生のポイント）、`cappedPoints`（そのプランに配られた分）、`capReached`（その特典が属するグループのどれかで「上限が設定され、グループの生のポイントの合計 ≥ 上限」）を返す。
- 計画1の `calculate` の振る舞い（内訳の並び、ショップ倍率の行、0ポイントの行の除去、警告）は変えない。計画1の `calculate.test.ts` はすべて変更なしで通ること。

- [ ] **Step 1: 失敗するテストを書く**

`cap-groups.test.ts`:
- `test("plan scope key")`: `capScope: "plan"` → `plan:<planId>:<benefitId>`。
- `test("month scope uses sharedKey and order month")`: `sharedKey: "spu-card"`、注文日 `2026-10-05` → `month:spu-card:2026-10`。
- `test("day scope falls back to benefit id")`: `sharedKey` なし、注文日 `2026-10-05` → `day:<benefitId>:2026-10-05`。

`calculate-all.test.ts`（特典はすべて `rate-bonus`、`rate: 1`）:
- `test("tax-included amount basis")`: 税込 3,300円の1商品、`amountBasis: "tax-included"`、`roundingUnit: "order"` → `33`。
- `test("month cap is shared across plans")`: 同じ ID の特典（`capScope: "month"`、`cap: 15`）を持つプラン P1・P2 に、10月の注文を1件ずつ（各税抜 1,000円 → 生 10）→ P1 と P2 の `cappedPoints` の和が `15`（`(planId, lineItemId)` 順で 8 と 7）、両方の `capReached: true`。
- `test("month cap resets across months")`: 1つのプランに 9月30日と10月1日の注文（各生 10）、`cap: 15` → 合計 `20`（月ごとに 10 で上限未満）。
- `test("day scope caps each day separately")`: `capScope: "day"`、`cap: 15`、10月5日に生 10 の注文2件と10月6日に生 10 の注文1件 → 5日分が `15`、6日分が `10`。
- `test("plan scope is not shared")`: P1・P2 が同じ ID の特典を `capScope: "plan"`、`cap: 15` で持ち、各生 10 → 各 `10`。
- `test("campaign scope shares one cap across plans")`: `capScope: "campaign"`、`sharedKey: "marathon-2026-10"`、`cap: 15`、P1・P2 各生 10 → 和 `15`。
- `test("mismatched caps use the minimum and warn")`: P1 の `cap: 15`、P2 の `cap: 12`（同じ ID、`month`）→ 和 `12`、両プランの `warnings` に `shared-cap-mismatch`。
- `test("calculate equals calculateAll for a single plan")`: 計画1の `calculate.test.ts` の複合的なプランの1つで、`calculate(plan, shops)` と `calculateAll([plan], shops).get(plan.id)` が等しい。
- 各テストの末尾で、各プランの `total` がその `breakdown` の和に等しいことを確かめる。

- [ ] **Step 2: テストが失敗することを確かめる**
  Run: `pnpm vitest run packages/domain/src/calculate`
  Expected: FAIL
- [ ] **Step 3: `capGroupKey`、`calculateAll` を実装し、`calculate` をその上に作り直す。`EligibleItem` の改名に合わせて特典の種類とそのテストを直す**
- [ ] **Step 4: 全テストが通ることを確かめる**
  Run: `pnpm check:all`
  Expected: すべて成功（計画1の計算エンジンのテストも変更なしで通る。`EligibleItem` の改名で必要になったテストのフィールド名の修正だけは許す）
- [ ] **Step 5: Commit**
  `git commit -m "feat(domain): calculate all plans with shared cap scopes"`

---

### Task 3: マスタデータの修正と定例キャンペーン

**Files:**
- Modify: `packages/domain/src/master/spu.ts`, `master/events.ts`, `master/master.test.ts`
- Create: `packages/domain/src/master/campaigns.ts`, `master/instantiate.ts`, `master/instantiate.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: Task 1 の `CampaignTemplate`、Task 2 の `calculateAll`
- Produces:
  - `campaignTemplates: CampaignTemplate[]`
  - `instantiateCampaign(template: CampaignTemplate, input: { id: Id; dates?: IsoDate[]; rate?: number; period?: Period }): Benefit`
    - `fixed`: テンプレートの特典をそのまま複製し、`id` だけ入力の値にする（`sharedKey` はテンプレートの値を保つ）。
    - `user-dates`: `dates`（1件以上、なければ例外）を `conditions.dateRule = { type: "dates", dates }` に入れる。`rate` があれば `params.rate` を上書きする。
    - `user-period`: `period`（なければ例外）を `conditions.dateRule = { type: "range", ...period }` に入れ、`sharedKey` を `<テンプレートの sharedKey>:<period.start>` にする（同じ開催を別のプランに入れても上限を共有するため）。

データの中身は設計書3節「計算が従う楽天の規則」の値と出典を使う。出典 URL と確認日（2026-10-04）を各ファイルの冒頭に書く。
- `spu.ts`:
  - 楽天カードを2項目に分ける。楽天カード通常分は `rate: 1`、`amountBasis: "tax-included"`、上限なし、`roundingUnit: "order"`、`capScope: "plan"`。楽天カード特典分は `rate: 1`、`amountBasis: "tax-excluded"`、`cap: 1000`、`roundingUnit: "order"`、`capScope: "month"`。ラベルとコメントで、通常分がカード本体の還元で楽天カードから付与されることを明記する。
  - 上限を持つ SPU の項目はすべて `capScope: "month"` にする。
- `events.ts`: マラソンの特典を `capScope: "campaign"`、`sharedKey: "marathon-2026-10"` にする。
- `campaigns.ts`（`category: "campaign"`、`enabled: false`、`channels: ["rakuten-ichiba", "rakuten-books"]`）:
  - 5と0のつく日: `occurrence: "fixed"`、`rate: 1`、`cap: 1000`、`capScope: "month"`、`sharedKey: "pointday"`、`dateRule: { type: "daysOfMonth", days: [5, 10, 15, 20, 25, 30] }`。楽天カード決済が条件であることをコメントに書く。
  - 勝ったら倍: `occurrence: "user-dates"`、`rate: 1`（両チーム勝利の日はユーザーが `rate: 2` で作る）、`cap: 1000`、`capScope: "day"`、`sharedKey: "sports-win"`、`minOrderAmount: 1000`。
  - 39ショップ: `occurrence: "user-period"`、`rate: 1`、`cap: 3000`、`capScope: "campaign"`、`sharedKey: "39shop"`、`shopTags: ["39shop"]`、`minOrderAmount: 3980`。対象額が税込か税抜かは公式ページの記述が条件金額のことか読み切れないため、`amountBasis` は既定（税抜）のまま、そのことをコメントに書く。
  - テンプレートの特典 ID は UUID の直書き。

- [ ] **Step 1: 失敗するテストを書く**

`master.test.ts` に追加:
- `test("card normal and card SPU are separate benefits")`: `standardSpu` に `amountBasis: "tax-included"` で上限のない `rate: 1` の項目と、`cap: 1000`・`capScope: "month"` の `rate: 1` の項目が1件ずつある。
- `test("capped SPU items are monthly")`: `cap` を持つ SPU の項目はすべて `capScope: "month"`。
- `test("campaign templates parse")`: 各テンプレートが `CampaignTemplateSchema` を通り、ID が SPU とイベントを含めて重複しない。

`instantiate.test.ts`:
- `test("fixed template copies the benefit with a new id")`
- `test("user-dates template sets dates and rate")`: 勝ったら倍に `dates: ["2026-10-05"]`、`rate: 2` → `dateRule` が `dates`、`params.rate` が `2`、`sharedKey` は `"sports-win"`。
- `test("user-dates without dates throws")`
- `test("user-period template scopes sharedKey by period start")`: 39ショップに `period: { start: "2026-10-04", end: "2026-10-11" }` → `sharedKey: "39shop:2026-10-04"`、`dateRule` が `range`。
- `test("pointday cap is shared across two plans in the same month")`: 5と0のつく日を有効にした2つのプランで、10月5日と10月10日に各税抜 60,000円（生 600）の注文 → `calculateAll` で両プランの5と0のつく日の `cappedPoints` の和が `1000`。

- [ ] **Step 2: テストが失敗することを確かめる**
  Run: `pnpm vitest run packages/domain/src/master`
  Expected: FAIL
- [ ] **Step 3: データとテンプレート、`instantiateCampaign` を実装し、`index.ts` から公開する**
- [ ] **Step 4: 全テストが通ることを確かめる**
  Run: `pnpm check:all`
  Expected: すべて成功
- [ ] **Step 5: Commit**
  `git commit -m "feat(domain): split Rakuten card rewards and add recurring campaigns"`
