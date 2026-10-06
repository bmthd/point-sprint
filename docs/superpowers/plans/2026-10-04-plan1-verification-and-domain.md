# 計画1: 外部連携の検証とドメイン基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 外部連携が設計どおりに使えるかを確かめ、モノレポの土台と、テスト済みの `@workspaces/domain`（モデル、購入先、特典の種類、計算エンジン、マイグレーション、マスタデータ）を作る。

**Architecture:** pnpm workspaces のモノレポに、React に依存しない `packages/domain` を置く。型はすべて Valibot のスキーマから導出し、計算エンジンは `calculate(plan, shops)` という純粋関数にする。特典の種類と購入先はレジストリに1件ずつ登録する拡張点とする。

**Tech Stack:** pnpm 12.9.1, TypeScript 7.0.2, Valibot 1.5.0, Vitest 5.0.3, oxlint 1.86.0, oxfmt 0.71.0, cspell 10.3.6

**Spec:** `docs/superpowers/specs/2026-10-04-rebuild-design.md`（用語は `docs/glossary.md`）

この計画は全4本の1本目である。2本目以降（`apps/web` と保存・状態・画面、外部連携の実装、配信と CI）は、この計画の完了後に別の計画として作る。

## Global Constraints

- パッケージ名は `@workspaces/domain`。`packages/domain` の `dependencies` は `valibot` だけにする（React、Jotai、ブラウザ API に依存しない）。
- パッケージはビルドせず、`"exports": { ".": "./src/index.ts" }` で TypeScript のソースを公開する。
- コード上の識別子は用語集の「英語名」に従う。
- 金額はすべて円の整数で扱う。ポイントの計算は浮動小数点の誤差を避けるため、倍率を百分の一単位の整数 `rateBp = Math.round(rate * 100)` に直し、`Math.floor(amount * rateBp / 10000)` で求める。
- 倍率 `rate` は「+N倍」の N である（`1` は税抜額の 1%）。
- 日付は `YYYY-MM-DD` の文字列、`updatedAt` は ISO 8601 のタイムスタンプ文字列とする。
- ID は UUID 文字列とする。
- テストは対象と同じディレクトリに `*.test.ts` として置く。
- `pnpm check:all`（lint、fmt:check、type:check、spell:check、test）がすべて通るまで、タスクは完了としない。

## Review Focus

1. **値引額が商品の金額を超える入力:** 不正な入力としてスキーマで拒否される（Task 3）。
2. **100円未満の商品や 0円の商品:** ポイントは 0 になり、負の値や NaN にならない（Task 4、Task 7）。
3. **税率 8% の商品（食品）:** 税込 1,080円 → 消費税 80円 → 税抜 1,000円と計算される（Task 4）。
4. **ショップ台帳にない `shopId` を持つ注文:** 例外を投げず、ショップ数にも購入先で絞る特典にも含めず、警告を返す（Task 9）。
5. **注文の並び順:** 注文の配列を並べ替えても、計算結果（内訳と合計）が変わらない（Task 9）。

---

## File Structure

```
package.json                 ルート。スクリプトと開発用の依存
pnpm-workspace.yaml
tsconfig.base.json
.oxlintrc.json
.oxfmtrc.json
cspell.json
vitest.config.ts             projects でパッケージごとのテストを束ねる
packages/domain/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                 公開 API の再エクスポート
    model/
      common.ts              Id、IsoDate、ChannelId、DateRule、Conditions
      shop.ts                Shop
      order.ts               LineItem、Order
      benefit.ts             Benefit（特典の種類のスキーマから組み立てる）
      plan.ts                Plan、Profile
      official-event.ts      OfficialEvent
    amounts/target-amount.ts 税込・税抜の対象額
    allocation/largest-remainder.ts
    channels/
      types.ts               ChannelDef、ParsedUrl
      rakuten-ichiba.ts
      rakuten-books.ts
      rakuma.ts
      index.ts               レジストリと parseUrl
    conditions/matches.ts    適用条件の判定
    benefit-kinds/
      types.ts               BenefitKindDef、EligibleItem
      points.ts              端数の単位ごとのポイント計算
      rate-bonus.ts
      shop-around.ts
      index.ts               レジストリ
    calculate/
      types.ts               CalculationResult など
      shop-count.ts
      calculate.ts
    migrations/
      runner.ts
      index.ts               CURRENT_SCHEMA_VERSION と migrations
    master/
      spu.ts                 SPU の標準定義
      events.ts              公式イベントの一覧
      create-plan.ts         プランの作成（スナップショット）
docs/superpowers/spikes/2026-10-04-external-integrations.md
```

---

### Task 1: 外部連携の検証（スパイク）

検証のためのコードは捨てるものなので、リポジトリには入れない。作業はスクラッチ用のディレクトリで行い、結果だけを文書にしてコミットする。

**この作業にはユーザーの協力が要る。** 楽天ウェブサービスのアプリ（`applicationId`、`accessKey`、`affiliateId`）、Cloudflare のアカウント、Email Routing を有効にしたドメインを、ユーザーに用意してもらう。楽天のアプリの「許可された Web サイト」には、検証用の Worker のドメイン（`*.workers.dev`）を登録してもらう。

**Files:**
- Create: `docs/superpowers/spikes/2026-10-04-external-integrations.md`

- [ ] **Step 1: ブラウザからの商品検索 API の呼び出しを確かめる**

Cloudflare の `cf` CLI（npm の `cf`、`cf auth login` で認証し `cf deploy` でデプロイする。Wrangler は使わない）で静的な HTML を1枚配信する Worker を作り、ページ内の JavaScript から `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701?applicationId=…&accessKey=…&affiliateId=…&itemCode=<実在のショップコード:商品管理番号>` を `fetch` で呼ぶ。
期待: レスポンスに `itemName`、`itemPrice`、`shopCode`、`shopName`、`pointRate`、`affiliateUrl` が含まれる。CORS で失敗したら、同じ URL に `callback` パラメータを付けて JSONP で呼び、結果を記録する。

- [ ] **Step 2: ビルド時（Node）からの呼び出しを確かめる**

Node のスクリプトから Step 1 と同じ URL を呼ぶ。`Referer` ヘッダーなし、`Referer: https://<許可したドメイン>/` ありの2通りを試す。
期待: どちらかで成功する。成功した方法を記録する。

- [ ] **Step 3: `send_email` を確かめる**

Worker に `send_email` バインディング（宛先は検証済みの管理者アドレス）を設定し、HTTP リクエストを受けたら固定の本文を送る。
期待: 管理者アドレスにメールが届く。

- [ ] **Step 4: Turnstile を確かめる**

Step 1 のページに Turnstile のウィジェットを置き、取得したトークンを Worker に送って `https://challenges.cloudflare.com/turnstile/v0/siteverify` で検証する。
期待: `success: true` が返る。

- [ ] **Step 5: 結果を文書にする**

`docs/superpowers/spikes/2026-10-04-external-integrations.md` に、Step 1〜4 のそれぞれについて「成否」「動いた呼び出し方（エンドポイント、パラメータ、ヘッダー、設定）」「制約」を書く。キーや実在のメールアドレスは書かない。
Step 1 で `fetch` も JSONP も失敗した場合、または Step 2 が両方失敗した場合は、文書の冒頭にその旨を書き、設計書6節を見直すまで計画2以降を止める。

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/spikes/2026-10-04-external-integrations.md
git commit -m "docs: record external integration spike results"
```

---

### Task 2: モノレポの土台

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `cspell.json`, `vitest.config.ts`
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/src/index.test.ts`

**Interfaces:**
- Produces: ルートのスクリプト `lint`（`oxlint --deny-warnings`）、`fmt`（`oxfmt`）、`fmt:check`（`oxfmt --check`）、`type:check`（`pnpm -r exec tsc --noEmit`）、`spell:check`（`cspell .`）、`test`（`vitest run`）、`check:all`（前の5つを順に実行）。

- [ ] **Step 1: ルートを作る**

ルートの `package.json` は `"private": true`、`"type": "module"`、`"packageManager": "pnpm@12.9.1"` とし、開発用の依存に `typescript@7.0.2`、`vitest@5.0.3`、`oxlint@1.86.0`、`oxfmt@0.71.0`、`cspell@10.3.6` を入れる。`pnpm-workspace.yaml` の `packages` は `["apps/*", "packages/*"]`。`tsconfig.base.json` は `strict: true`、`noUncheckedIndexedAccess: true`、`module: "preserve"`、`moduleResolution: "bundler"`、`verbatimModuleSyntax: true`、`target: "es2023"`。`.oxlintrc.json` と `.oxfmtrc.json` は `--init` で作り、`.oxfmtrc.json` は行幅 100、インデント 2 にする。`cspell.json` は `language: "en"`、`ignorePaths` に `pnpm-lock.yaml` と `docs/**`、`words` に `rakuten`、`rakuma`、`fril`、`valibot`、`oxlint`、`oxfmt`、`seitu`、`tsbuildinfo` を入れる。ルートの `vitest.config.ts` は `test.projects: ["packages/*"]`。

- [ ] **Step 2: `packages/domain` を作る**

`package.json` は `name: "@workspaces/domain"`、`"type": "module"`、`"exports": { ".": "./src/index.ts" }`、`dependencies` は `valibot@1.5.0` だけ。`tsconfig.json` は `tsconfig.base.json` を継承し `include: ["src"]`。

- [ ] **Step 3: 最初のテストを書く**

```ts
// packages/domain/src/index.test.ts
import { expect, test } from "vitest";
import * as domain from "./index";

test("domain package loads", () => {
  expect(domain).toBeTypeOf("object");
});
```

- [ ] **Step 4: 全チェックを実行する**

Run: `pnpm install && pnpm check:all`
Expected: すべて成功する（テスト 1 件 PASS）。

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .oxlintrc.json .oxfmtrc.json cspell.json vitest.config.ts packages/domain
git commit -m "chore: scaffold pnpm monorepo with domain package"
```

---

### Task 3: モデルのスキーマ

**Files:**
- Create: `packages/domain/src/model/common.ts`, `shop.ts`, `order.ts`, `plan.ts`, `official-event.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/model/order.test.ts`, `plan.test.ts`

`Benefit` のスキーマは Task 6 で特典の種類から組み立てる。このタスクの `plan.ts` は `BenefitSchema` を `./benefit` から読み込むので、Task 6 までは `benefit.ts` に仮の `export const BenefitSchema = v.object({ id: IdSchema })` を置き、Task 6 で置き換える。

**Interfaces:**
- Produces（すべて `@workspaces/domain` から公開。型は `v.InferOutput` で導出し、スキーマ名から `Schema` を除いた名前にする）:
  - `IdSchema = v.pipe(v.string(), v.uuid())`
  - `IsoDateSchema = v.pipe(v.string(), v.isoDate())`
  - `TimestampSchema = v.pipe(v.string(), v.isoTimestamp())`
  - `ChannelIdSchema = v.picklist(["rakuten-ichiba", "rakuten-books", "rakuma"])`
  - `DateRuleSchema = v.variant("type", [{ type: "daysOfMonth", days: number[] (整数 1〜31, 1件以上) }, { type: "range", start: IsoDate, end: IsoDate }])`
  - `ConditionsSchema = v.object({ channels?: ChannelId[], shopIds?: Id[], dateRule?: DateRule, minOrderAmount?: 整数 ≥ 0 })`
  - `ShopSchema = { id, channel: ChannelId, shopCode?: string, name: string (1文字以上), updatedAt: Timestamp }`
  - `LineItemSchema = { id, name: string, unitPrice: 整数 ≥ 0, quantity: 整数 ≥ 1, taxRate: v.picklist([0.1, 0.08]), discount: 整数 ≥ 0（既定 0）, shopPointRate?: 数 ≥ 1, itemCode?: string, url?: URL }`。`discount ≤ unitPrice × quantity` を `v.check` で検証する。
  - `OrderSchema = { id, shopId: Id, date: IsoDate, lineItems: LineItem[]（1件以上） }`
  - `PlanSchema = { id, name: string, officialEventId?: string, period: { start: IsoDate, end: IsoDate }, benefits: Benefit[], orders: Order[], updatedAt: Timestamp }`
  - `ProfileSchema = { spuBenefits: Benefit[], updatedAt: Timestamp }`
  - `OfficialEventSchema = { id: string, name: string, period: { start, end }, benefits: Benefit[] }`

- [ ] **Step 1: 失敗するテストを書く**

`order.test.ts`:
- `test("accepts a line item with default discount")`: `discount` を省いた有効な商品を `v.parse(LineItemSchema, …)` すると `discount` が `0` になる。
- `test("rejects discount larger than the line amount")`: `unitPrice: 1000, quantity: 2, discount: 2001` は `v.safeParse(...).success === false`。
- `test("rejects an order without line items")`: `lineItems: []` は失敗する。
- `test("rejects unsupported tax rate")`: `taxRate: 0.05` は失敗する。

`plan.test.ts`:
- `test("rejects a date rule with day 32")`: `{ type: "daysOfMonth", days: [32] }` は失敗する。
- `test("accepts a plan with no orders")`: `orders: []`、`benefits: []` のプランは成功する。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/model`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 上の Interfaces どおりにスキーマを実装し、`index.ts` から再エクスポートする**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/model`
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): add model schemas"
```

---

### Task 4: 対象額と按分

**Files:**
- Create: `packages/domain/src/amounts/target-amount.ts`, `packages/domain/src/allocation/largest-remainder.ts`
- Test: `packages/domain/src/amounts/target-amount.test.ts`, `packages/domain/src/allocation/largest-remainder.test.ts`

**Interfaces:**
- Produces:
  - `taxIncludedTarget(item: LineItem): number` = `unitPrice * quantity - discount`
  - `taxExcludedTarget(item: LineItem): number` = 税込の対象額 − `Math.floor(税込の対象額 * taxRate / (1 + taxRate))`。浮動小数点の誤差を避けるため、税率は百分率の整数（10 または 8）で `Math.floor(incl * pct / (100 + pct))` と計算する。
  - `largestRemainder(total: number, weights: number[]): number[]`: `total` を `weights` の比で整数に分け、和を `total` に一致させる。剰余の大きい順に1ずつ足し、剰余が同じなら添字の小さい方を優先する。`weights` がすべて 0 のときは均等な重みとして扱う。`weights` が空なら空配列を返す。

- [ ] **Step 1: 失敗するテストを書く**

`target-amount.test.ts`:
- `test("tax-excluded 1,980 yen at 10% is 1,800")`: `unitPrice: 1980, quantity: 1, taxRate: 0.1` → 税抜 `1800`（FAQ の例）。
- `test("tax-excluded 1,080 yen at 8% is 1,000")`
- `test("applies discount before tax extraction")`: `unitPrice: 1100, quantity: 2, discount: 200, taxRate: 0.1` → 税込 `2000`、税抜 `2000 - floor(2000*10/110) = 2000 - 181 = 1819`。
- `test("zero-price item yields zero")`: 税込・税抜とも `0`。

`largest-remainder.test.ts`:
- `test("splits 10 by 1:1:1 as 4,3,3")`
- `test("keeps the sum for uneven weights")`: `largestRemainder(7, [1800, 1200])` → `[4, 3]`（4.2 と 2.8 → 剰余 0.8 の方に1を足す）。
- `test("all-zero weights are treated as equal")`: `largestRemainder(3, [0, 0])` → `[2, 1]`。
- `test("empty weights")`: `largestRemainder(0, [])` → `[]`。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/amounts packages/domain/src/allocation`
Expected: FAIL

- [ ] **Step 3: 2つの関数を実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/amounts packages/domain/src/allocation`
Expected: PASS（8件）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/amounts packages/domain/src/allocation
git commit -m "feat(domain): add target amounts and largest remainder allocation"
```

---

### Task 5: 購入先と適用条件

**Files:**
- Create: `packages/domain/src/channels/types.ts`, `rakuten-ichiba.ts`, `rakuten-books.ts`, `rakuma.ts`, `index.ts`
- Create: `packages/domain/src/conditions/matches.ts`
- Test: `packages/domain/src/channels/index.test.ts`, `packages/domain/src/conditions/matches.test.ts`

**Interfaces:**
- Produces:
  - `type ParsedUrl = { channel: ChannelId; shopCode?: string; itemManageNumber?: string }`
  - `interface ChannelDef { id: ChannelId; label: string; shopUnit: "per-shop" | "single"; countsTowardShopAround: boolean; receivesShopAround: boolean; supportsItemLookup: boolean; parseUrl(url: URL): ParsedUrl | null }`
  - `channels: Record<ChannelId, ChannelDef>`（設計書2節の表の値を使う。ラベルは「楽天市場」「楽天ブックス」「ラクマ」）
  - `parseUrl(input: string): ParsedUrl | null`: `new URL` に失敗したら `null`。各購入先の `parseUrl` を順に試す。
  - `toItemCode(parsed: ParsedUrl): string | null`: `shopCode` と `itemManageNumber` が両方あれば `${shopCode}:${itemManageNumber}`。
  - `interface ConditionContext { channel: ChannelId; shopId: string; date: string; orderTaxIncluded: number }`
  - `matchesConditions(conditions: Conditions, ctx: ConditionContext): boolean`: 指定のない条件は満たすものとし、指定された条件をすべて満たすとき `true`。`daysOfMonth` は日付の「日」が `days` に含まれるか、`range` は `start ≤ date ≤ end`（文字列比較）、`minOrderAmount` は `orderTaxIncluded ≥ minOrderAmount`。

URL の判定規則:
- 楽天市場: ホストが `item.rakuten.co.jp` ならパスの第1区切りをショップコード、第2区切りを商品管理番号とする。ホストが `www.rakuten.co.jp` ならパスの第1区切りをショップコードとし、`/^[a-z0-9_-]+$/i` に合わなければ `null`。
- 楽天ブックス: ホストが `books.rakuten.co.jp`。
- ラクマ: ホストが `item.fril.jp`、`fril.jp`、`rakuma.rakuten.co.jp` のいずれか。

- [ ] **Step 1: 失敗するテストを書く**

`channels/index.test.ts`:
- `test("parses an Ichiba item URL")`: `https://item.rakuten.co.jp/shop-a/item-123/` → `{ channel: "rakuten-ichiba", shopCode: "shop-a", itemManageNumber: "item-123" }`、`toItemCode` → `"shop-a:item-123"`。
- `test("parses an Ichiba shop URL")`: `https://www.rakuten.co.jp/shop-a/` → `shopCode: "shop-a"`、`itemManageNumber` なし。
- `test("parses Books and Rakuma URLs")`: `https://books.rakuten.co.jp/rb/12345/` → `rakuten-books`、`https://item.fril.jp/abc` → `rakuma`。
- `test("returns null for unrelated or invalid URLs")`: `https://example.com/` と `not a url`。
- `test("Rakuma counts toward shop-around but does not receive it")`: `channels.rakuma.countsTowardShopAround === true`、`receivesShopAround === false`。

`conditions/matches.test.ts`:
- `test("days ending in 0 or 5")`: `days: [5, 10, 15, 20, 25, 30]` に対して `2026-10-05` は `true`、`2026-10-06` は `false`。
- `test("channel filter")`: `channels: ["rakuten-ichiba"]` に対して `rakuma` は `false`。
- `test("minimum order amount boundary")`: `minOrderAmount: 3980` に対して `3979` は `false`、`3980` は `true`。
- `test("empty conditions always match")`

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/channels packages/domain/src/conditions`
Expected: FAIL

- [ ] **Step 3: 購入先と `matchesConditions` を実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/channels packages/domain/src/conditions`
Expected: PASS（9件）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/channels packages/domain/src/conditions
git commit -m "feat(domain): add channels registry and condition matching"
```

---

### Task 6: 特典の種類

**Files:**
- Create: `packages/domain/src/benefit-kinds/types.ts`, `points.ts`, `rate-bonus.ts`, `shop-around.ts`, `index.ts`
- Modify: `packages/domain/src/model/benefit.ts`（Task 3 の仮のスキーマを置き換える）
- Test: `packages/domain/src/benefit-kinds/points.test.ts`, `rate-bonus.test.ts`, `shop-around.test.ts`

**Interfaces:**
- Consumes: `largestRemainder`（Task 4）、`ConditionsSchema`（Task 3）
- Produces:
  - `type EligibleItem = { lineItemId: string; orderId: string; taxExcluded: number }`
  - `type RoundingUnit = "item" | "order"`
  - `pointsFor(items: EligibleItem[], rate: number, unit: RoundingUnit): Map<string, number>`: `item` は商品ごとに `Math.floor(taxExcluded * rateBp / 10000)`。`order` は `orderId` ごとに税抜額を合計して同じ式で求め、その注文の商品へ税抜額の比で `largestRemainder` により按分する。
  - `interface BenefitKindDef<K extends string, P extends { cap?: number }> { kind: K; paramsSchema: v.GenericSchema<P>; defaultParams: P; onlyReceivingChannels: boolean; rawPoints(input: { params: P; items: EligibleItem[]; shopCount: number }): Map<string, number> }`
  - `rateBonus`: `kind: "rate-bonus"`、`params = { rate: 数 > 0, cap?: 整数 ≥ 0, roundingUnit: RoundingUnit（既定 "item"） }`、`onlyReceivingChannels: false`、`rawPoints` は `pointsFor(items, params.rate, params.roundingUnit)`。
  - `shopAround`: `kind: "shop-around"`、`params = { tiers: { minShops: 整数 ≥ 1, rate: 数 ≥ 0 }[]（1件以上）, cap?: 整数 ≥ 0, roundingUnit: RoundingUnit（既定 "item"） }`、`onlyReceivingChannels: true`。倍率は `minShops ≤ shopCount` を満たす段階のうち `minShops` が最大のものの `rate`、該当がなければ 0。
  - `benefitKinds = { "rate-bonus": rateBonus, "shop-around": shopAround } as const`
  - `BenefitSchema`: `v.variant("kind", [...])`。各要素は `{ id: Id, kind: v.literal(K), category: v.picklist(["spu", "campaign"]), label: string, enabled: boolean, conditions: Conditions（既定 {}）, params: その種類の paramsSchema }`。`benefitKinds` の各要素から組み立てる。

特典の種類を追加するときは、`benefit-kinds/` にファイルを1つ足し、`benefit-kinds/index.ts` の `benefitKinds` と `BenefitSchema` の候補に1行ずつ足す。

- [ ] **Step 1: 失敗するテストを書く**

`points.test.ts`:
- `test("+1 per item: 3,000 yen yields 30")`: 税抜 `3000` の1商品、`rate: 1`、`item` → `30`（FAQ の例）。
- `test("+0.5 per item floors per item")`: 税抜 `[199, 199]` の2商品、`rate: 0.5` → `[0, 0]`。
- `test("+0.5 per order sums before flooring")`: 同じ2商品が同じ注文 → 注文で `floor(398 * 50 / 10000) = 1`、按分して `[1, 0]`。
- `test("fractional rate does not suffer float error")`: 税抜 `1000`、`rate: 0.1` → `1`。

`rate-bonus.test.ts`:
- `test("default params parse")`: `v.parse(rateBonus.paramsSchema, { rate: 1 })` の `roundingUnit` が `"item"`。

`shop-around.test.ts`:
- 段階 `[{minShops:2,rate:1},{minShops:3,rate:2},…,{minShops:10,rate:9}]` を使う。
- `test("one shop gives no bonus")`: `shopCount: 1` → すべて `0`。
- `test("ten shops give +9")`: 税抜 `10000`、`shopCount: 10` → `900`。
- `test("eleven shops stay at +9")`: `shopCount: 11` → `900`。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/benefit-kinds`
Expected: FAIL

- [ ] **Step 3: `pointsFor`、2つの種類、レジストリ、`BenefitSchema` を実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src`
Expected: PASS（Task 3 のテストも `BenefitSchema` の置き換え後に通る）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src
git commit -m "feat(domain): add benefit kinds rate-bonus and shop-around"
```

---

### Task 7: ショップ数

**Files:**
- Create: `packages/domain/src/calculate/shop-count.ts`
- Test: `packages/domain/src/calculate/shop-count.test.ts`

**Interfaces:**
- Consumes: `taxIncludedTarget`（Task 4）、`channels`（Task 5）
- Produces: `countShops(orders: Order[], shops: Shop[]): number`。`shopId` ごとに税込の対象額を累計し、ショップの購入先が `countsTowardShopAround` で、累計が 1,000 以上のショップの数を返す。台帳にない `shopId` は数えない。

- [ ] **Step 1: 失敗するテストを書く**

- `test("999 yen is not counted, 1,000 yen is")`
- `test("two orders at the same shop accumulate to one shop")`: 600円と400円の2注文 → `1`。
- `test("two orders of 1,000 yen at the same shop count once")` → `1`。
- `test("Rakuma counts as a shop")`: 楽天市場 1ショップとラクマ 1ショップ、それぞれ 1,000円 → `2`。
- `test("discount is subtracted before the threshold")`: `unitPrice: 1100, discount: 200` → `0`。
- `test("unknown shop is ignored")`: 台帳にない `shopId` の 5,000円 → `0`。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/calculate/shop-count.test.ts`
Expected: FAIL

- [ ] **Step 3: `countShops` を実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/calculate/shop-count.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/calculate/shop-count.ts packages/domain/src/calculate/shop-count.test.ts
git commit -m "feat(domain): count shops for shop-around"
```

---

### Task 8: マイグレーションの仕組み

**Files:**
- Create: `packages/domain/src/migrations/runner.ts`, `packages/domain/src/migrations/index.ts`
- Test: `packages/domain/src/migrations/runner.test.ts`

**Interfaces:**
- Produces:
  - `type StoreName = "plans" | "shops" | "profile"`
  - `type Migration = { to: number; stores: Partial<Record<StoreName, (row: unknown) => unknown>> }`
  - `CURRENT_SCHEMA_VERSION = 1`、`migrations: Migration[] = []`
  - `migrateRow(store: StoreName, row: unknown, fromVersion: number, list: Migration[] = migrations): unknown`: `to > fromVersion` のマイグレーションを `to` の昇順に適用する。その版に対象ストアの変換がなければ行をそのまま次へ渡す。

計画2のリポジトリが、Seitu の `onUpgrade` の中でストアごとに `migrateRow` を呼ぶ。変換関数は同期の純粋関数でなければならない（Seitu の `onUpgrade` は同期で実行されるため）。

- [ ] **Step 1: 失敗するテストを書く**

テスト用のマイグレーション列 `[{ to: 2, stores: { plans: (r) => ({ ...r, a: 1 }) } }, { to: 3, stores: { plans: (r) => ({ ...r, b: 2 }), shops: (r) => ({ ...r, c: 3 }) } }]` を使う。
- `test("applies migrations after fromVersion in order")`: `migrateRow("plans", {}, 1, list)` → `{ a: 1, b: 2 }`。
- `test("skips migrations already applied")`: `fromVersion: 2` → `{ b: 2 }`。
- `test("passes through stores without a transform")`: `migrateRow("shops", {}, 1, list)` → `{ c: 3 }`。
- `test("current version has no pending migrations")`: `migrateRow("plans", { x: 1 }, CURRENT_SCHEMA_VERSION)` → `{ x: 1 }`。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/migrations`
Expected: FAIL

- [ ] **Step 3: `migrateRow` を実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/migrations`
Expected: PASS（4件）

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/migrations
git commit -m "feat(domain): add schema migration runner"
```

---

### Task 9: 計算エンジン

**Files:**
- Create: `packages/domain/src/calculate/types.ts`, `packages/domain/src/calculate/calculate.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/calculate/calculate.test.ts`

**Interfaces:**
- Consumes: Task 4〜7 のすべて
- Produces:
  - `type BreakdownRow = { lineItemId: string; source: string; points: number }`（`source` は特典の `id` か `"shop-rate"`）
  - `type BenefitTotal = { benefitId: string; rawPoints: number; cappedPoints: number; capReached: boolean }`
  - `type CalculationWarning = { type: "unknown-shop"; orderId: string } | { type: "order-outside-period"; orderId: string }`
  - `type CalculationResult = { breakdown: BreakdownRow[]; benefitTotals: BenefitTotal[]; shopCount: number; total: number; warnings: CalculationWarning[] }`
  - `calculate(plan: Plan, shops: Shop[]): CalculationResult`

処理は設計書3節「計算の手順」に従う。このタスクで決める点は次のとおり。
- 有効でない特典（`enabled: false`）は `benefitTotals` にも `breakdown` にも出さない。
- 台帳にない `shopId` の注文は、購入先を持たないので、`conditions.channels` を指定した特典と `shop-around` の対象から外す。購入先を指定しない特典の対象には含める。`unknown-shop` の警告を出す。
- 注文の `date` が `plan.period` の外なら `order-outside-period` の警告を出す。特典の計算からは外さないが、ショップ数（期間中の累計で数える）には含めない。
- ショップ倍率は、`shopPointRate` を持つ商品ごとに `pointsFor` を倍率 `shopPointRate - 1`、単位 `item` で求め、`source: "shop-rate"` の行にする。上限はない。
- 対象の商品は、按分の前に必ず `lineItemId` の昇順に並べる。`largestRemainder` は剰余が同じとき添字の小さい方を優先するので、並べておかないと注文の入力順で結果が変わる。
- 適用条件の `orderTaxIncluded` には、その注文の商品の税込の対象額の和を渡す。
- 上限は `params.cap` があるときだけかける。上限を超えたら `cappedPoints = cap` とし、商品ごとの生のポイントを重みとして `largestRemainder(cap, …)` で配り直す。
- `breakdown` から `points: 0` の行を除く。`total` は `breakdown` の `points` の和。

- [ ] **Step 1: 失敗するテストを書く**

共通のテストデータとして、楽天市場のショップ A・B、ラクマのショップ R、SPU「通常ポイント」（`rate-bonus`、`rate: 1`）、買いまわり（`shop-around`、Task 6 の段階、`cap: 7000`）を用意する。

- `test("base points only")`: ショップ A で税込 3,300円（税抜 3,000円）の1商品 → `total: 30`、内訳は通常ポイントの1行。
- `test("shop-around applies to all receiving orders")`: A 1,100円、B 1,100円 → `shopCount: 2`、買いまわりは各商品 `floor(1000 * 100 / 10000) = 10` で計 20。
- `test("Rakuma counts but does not receive shop-around")`: A 1,100円、R 1,100円 → `shopCount: 2`、買いまわりの行は A の商品だけ。
- `test("cap is applied and allocated proportionally")`: 買いまわり `cap: 15` で、生のポイントが A の商品 10、B の商品 10 → `cappedPoints: 15`、`capReached: true`、内訳は 8 と 7。
- `test("order of orders does not change the result")`: 上限で按分の剰余が同点になる3注文のプランと、`orders` を逆順にしたプランの `total` と、`lineItemId` で並べた `breakdown` が等しい。
- `test("disabled benefits are ignored")`
- `test("unknown shop yields a warning and is excluded from shop-around")`: 台帳にないショップの 5,000円の注文 → `warnings` に `unknown-shop`、通常ポイントは付き、買いまわりの対象には入らない。
- `test("shop point rate adds a shop-rate row")`: 税抜 1,000円、`shopPointRate: 3` → `source: "shop-rate"` の行が `20`。
- `test("order outside the plan period yields a warning")`
- `test("breakdown sums to total")`: 上のどのケースでも `total === sum(breakdown.points)`（各テストの末尾で確かめる）。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/calculate/calculate.test.ts`
Expected: FAIL

- [ ] **Step 3: `calculate` を実装し、`index.ts` から公開する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `pnpm vitest run packages/domain/src/calculate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/calculate packages/domain/src/index.ts
git commit -m "feat(domain): add calculation engine with breakdown and caps"
```

---

### Task 10: マスタデータとプランの作成

**Files:**
- Create: `packages/domain/src/master/spu.ts`, `events.ts`, `create-plan.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/master/master.test.ts`, `create-plan.test.ts`

**Interfaces:**
- Consumes: `BenefitSchema`、`OfficialEventSchema`、`PlanSchema`、`ProfileSchema`
- Produces:
  - `standardSpu: Benefit[]`（`category: "spu"`）
  - `officialEvents: OfficialEvent[]`
  - `createPlan(input: { id: string; name: string; event?: OfficialEvent; profile: Profile; now: string }): Plan`: `benefits` は `profile.spuBenefits` と `event?.benefits` の複製（`structuredClone`）を連結したもの。`period` は `event` があればその期間、なければ `now` の日付を開始日と終了日にする。`orders` は空、`updatedAt` は `now`。

データの中身は、実装する時点の楽天の公式ページから写す。
- `standardSpu`: [SPU の公式ページ](https://event.rakuten.co.jp/campaign/point-up/everyday/point/) の各項目を `rate-bonus` で表す。必ず「通常ポイント」（`rate: 1`、上限なし、`item`）を含める。楽天カードの項目は `roundingUnit: "order"` にする。各項目の倍率と上限は公式ページの値を使い、ファイル冒頭のコメントに確認日と URL を書く。
- `officialEvents`: 実装時点で開催予定または開催中のお買い物マラソンを1件入れる。期間、買いまわりの段階と上限、0と5のつく日などの特典を [お買い物マラソンの公式ページ](https://event.rakuten.co.jp/campaign/point-up/marathon/) から写し、確認日と URL をコメントに書く。

- [ ] **Step 1: 失敗するテストを書く**

`master.test.ts`:
- `test("standard SPU parses")`: `standardSpu` の各要素が `v.parse(BenefitSchema, …)` を通る。
- `test("standard SPU includes base points")`: `rate: 1` で `cap` のない `rate-bonus` が1件ある。
- `test("official events parse")`: 各要素が `OfficialEventSchema` を通り、`period.start ≤ period.end`。
- `test("benefit ids are unique across SPU and every event")`

`create-plan.test.ts`:
- `test("snapshots profile SPU and event benefits")`: 作ったプランの `benefits` の長さが両者の和で、プランの特典を書き換えても `profile` は変わらない。
- `test("plan without event uses today as period")`
- `test("created plan parses")`: 結果が `PlanSchema` を通る。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `pnpm vitest run packages/domain/src/master`
Expected: FAIL

- [ ] **Step 3: データファイルと `createPlan` を実装し、`index.ts` から公開する**

- [ ] **Step 4: 全チェックを実行する**

Run: `pnpm check:all`
Expected: すべて成功する。

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/master packages/domain/src/index.ts
git commit -m "feat(domain): add master data and plan creation"
```
