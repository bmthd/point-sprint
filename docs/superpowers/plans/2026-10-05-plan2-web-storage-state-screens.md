# 計画2: Web アプリ、保存、状態、画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web`（TanStack Start）と `@workspaces/ui`（Yamada UI）を作り、IndexedDB（Seitu）への保存、TanStack Query と Jotai による状態、そしてキャンバス「ポイントスプリント UI」の5画面（プラン一覧、プランのホーム、注文の追加・編集、プランの設定、PC のダッシュボード）とプロフィールを実装する。

**Architecture:** 設計書4節の一方向の流れ（リポジトリ → TanStack Query → Jotai → UI）に従う。計算は `@workspaces/domain` の `calculateAll` を Jotai の派生 atom で呼び、画面には `groupTotals`、`heldEstimates`、`shopAroundOutlook` をそのまま使う。全ページを事前レンダリングし、端末のデータを読む部分は `ClientOnly` の中で描画する。見た目は `docs/design-system.md` のトークンだけで指定する。

**Tech Stack:** TanStack Start（`@tanstack/react-start`）、React 19、Vite、Yamada UI v2（`@yamada-ui/cli` で生成する `@workspaces/ui`）、Formisch（`@formisch/react`）、Valibot、TanStack Query v5、Jotai、jotai-tanstack-query、Seitu、Vitest（ブラウザモードは `@vitest/browser` と Playwright）、Playwright

**Spec:** `docs/superpowers/specs/2026-10-04-rebuild-design.md`（2〜5節、7節）、`docs/design-system.md`、用語は `docs/glossary.md`。

**画面の正:** キャンバス「ポイントスプリント UI」（https://claude.ai/artifact/RAnTNahSTnKae2iax12K64）。各タスクの実装者は、担当する画面のアートボードを Artifact ツールの `read`（`path` に `project/<アートボード名>.dc.html`）で読み、構成・文言・状態をそれに合わせる。アートボードの色は CSS 変数で書いてあり、変数名は `docs/design-system.md` のトークン名に対応する（`--bg-panel` → `bg.panel`）。

この計画は全4本の2本目である。商品情報の取得（URL から API で自動入力）、広告、問い合わせ、Analytics・AdSense・共有ボタンの中身は計画3、配信と CI は計画4で扱う。この計画では、それらの置き場所（ボタンや枠）だけを作る。

## Global Constraints

- 計画1・1b・1c の Global Constraints を引き継ぐ。
- 依存の向きは `web → ui`、`web → domain` だけ。`apps/web` は Yamada UI を直接 import せず、`@workspaces/ui` から import する。
- 依存パッケージは実装時点の最新の安定版を入れ、`package.json` に正確な版を固定する（`^` を付けない）。
- 画面の文言は日本語で、キャンバスの文言に合わせる。注文の操作の名前は「コピー」（「複製」は使わない）。
- 色は `docs/design-system.md` のトークン（`bg.*`、`fg.*`、`border.*`、`colorScheme` の `primary` など、`point.*`）だけで指定する。16進数の色を部品に書かない。ライトとダークの両方で表示を確かめる。
- 数値は等幅数字（`font-variant-numeric: tabular-nums`）。タップ領域は 44px 以上。開閉・トグル・チップの選択状態は `aria-expanded` / `aria-pressed` などで表し、キーボードだけで操作できるようにする（追加、カウントの切り替え、並べ替え、展開を含む）。
- 端末のデータは事前レンダリングの HTML に含めない。データを読むコンポーネントは `@tanstack/react-router` の `ClientOnly` の中に置く。
- 値は「リポジトリ → TanStack Query → Jotai → UI」の一方向にだけ流す。Jotai の atom が自分で値を持つのは UI の一時的な状態だけにする。
- IndexedDB のデータベース名は `point-sprint`、Seitu の `version` は `CURRENT_SCHEMA_VERSION`。
- `pnpm check:all` に `apps/web` と `packages/ui` の型チェック、リント、テストを含める。Playwright の E2E は `pnpm test:e2e` として別にする。
- 画面の幅 390px、768px、1280px で崩れないこと（PC の表は箱の中の横スクロールでよい）。

## Review Focus

1. **保存データが壊れている:** 検証を通らないレコードは退避され、画面は残りのデータで動き、その旨を表示する（Task 5、Task 12）。
2. **入力途中の不正な値:** 金額欄を空にしたり文字を入れたりしても、計算と保存は直前の有効な値のまま（Task 10）。
3. **1件の編集で全体が再描画される:** ある注文の金額を変えても、ほかの注文のカードや行は再描画されない（Task 8 の描画回数のテスト）。
4. **排他の SPU:** 楽天カードを ON にすると楽天プレミアムカードが OFF になり、その逆も同じ（Task 3、Task 11）。
5. **再読み込み:** プラン、注文の並び、保留、特典の ON/OFF、ショップ台帳が残る（Task 12）。

---

## File Structure

```
packages/ui/                           @workspaces/ui（Yamada UI CLI が生成）とテーマ
  src/theme/                           パレット brand、カラースキーム、セマンティックトークンの上書きと point.*
packages/domain/src/
  benefit-kinds/index.ts               exclusiveGroup
  master/spu.ts                        楽天プレミアムカードの項目、排他グループ
  plan-ops/benefit-ops.ts              toggleBenefit
apps/web/
  vite.config.ts, vitest.config.ts, playwright.config.ts
  src/
    router.tsx
    routes/__root.tsx, index.tsx, plan.tsx, plan.settings.tsx, profile.tsx
    storage/repository.ts, memory-repository.ts, indexed-db-repository.ts
    state/query-client.ts, repository-atom.ts, queries.ts, mutations.ts, calculation.ts, ui.ts
    app-providers.tsx
    features/
      plan-list/                       プラン一覧（PlanList）
      plan-home/
        summary-card.tsx               サマリーカード（ドット、ゲージ、ヒント、内訳）
        point-breakdown.tsx            4区分の積み上げバーと凡例（共通部品）
        warnings.tsx
        order-list.tsx, order-card.tsx      スマホの注文カード
        order-table.tsx, order-row.tsx      PC の表
        shop-ladder.tsx                「あと何店舗回る？」
        bottom-bar.tsx
      order-editor/                    注文の追加・編集（ボトムシート / PC は入力行とダイアログ）
      plan-settings/
        spu-tiles.tsx, campaign-toggles.tsx, campaign-adder.tsx, shop-around-settings.tsx
      profile/
        spu-defaults.tsx, shop-registry.tsx
  e2e/plan-flow.spec.ts
```

---

### Task 1: `apps/web` の土台

**Files:** `apps/web/package.json`、`vite.config.ts`、`tsconfig.json`、`vitest.config.ts`、`src/router.tsx`、`src/routes/__root.tsx`・`index.tsx`・`plan.tsx`・`plan.settings.tsx`・`profile.tsx`、ルートの `package.json`（`dev`、`build`）・`vitest.config.ts`（`apps/*`）・リント等の除外（`routeTree.gen.ts`）。Test: `apps/web/src/routes/routes.test.ts`

**Interfaces:**
- ルート: `/`（プラン一覧）、`/plan?id=`（プランのホーム）、`/plan/settings?id=`（プランの設定）、`/profile`。`/plan` と `/plan/settings` は `validateSearch` に `v.object({ id: v.optional(v.string()) })`。各ページは見出しだけの仮の画面。
- `vite.config.ts` は `tanstackStart({ prerender: { enabled: true, crawlLinks: true } })` と `@vitejs/plugin-react` をこの順で入れる。`apps/web/package.json` の `name` は `web`。

- [ ] **Step 1:** 失敗するテスト `test("plan route validates search id")` を書く（`{ id: "abc" }` → `{ id: "abc" }`、`{}` → `id` は `undefined`）。
- [ ] **Step 2:** 失敗を確かめる（`pnpm vitest run apps/web` → FAIL）。
- [ ] **Step 3:** TanStack Start の公式の「Build From Scratch」に従って土台を作り、4ルートを置く。
- [ ] **Step 4:** `pnpm build` が成功し、4ルートの HTML が事前レンダリングされることを確かめる（出力先を報告に書く）。
- [ ] **Step 5:** `pnpm check:all` を通し、Commit `feat(web): scaffold TanStack Start app with prerendered routes`。

---

### Task 2: `@workspaces/ui` とテーマ

**Files:** `packages/ui/`（CLI が生成）、`packages/ui/src/theme/*`、`apps/web/src/routes/__root.tsx`（`UIProvider`）、`docs/design-system.md`（余白・角丸の割り当てを追記）。Test: `apps/web/src/routes/root.browser.test.tsx`

**Interfaces:**
- リポジトリのルートで `pnpm dlx @yamada-ui/cli@latest init -y -m -p @workspaces/ui -s --no-format --no-lint` を実行し、`packages/ui` に置く。`yamada-cli add` で必要なコンポーネントだけを足す。
- テーマ（`docs/design-system.md` のとおり）:
  - パレット `brand`（50〜950 の11値）を追加する。
  - `colorSchemes` の `primary` と `link` を `brand` にする。ほかは既定。
  - セマンティックトークン `bg.base`・`bg.panel`・`border.emphasized` を文書の値に上書きする。
  - セマンティックトークン `point.base`・`point.spu`・`point.marathon`・`point.campaign` を追加する。
  - 本文のフォントを Noto Sans JP にする。
- Yamada UI の既定の余白・角丸の目盛りを確認し、文書の「形と余白」の値をどのトークン名に当てるかを `docs/design-system.md` に追記する。
- Vitest のブラウザモード（chromium、`*.browser.test.tsx`）をここで設定する。

- [ ] **Step 1:** CLI で `packages/ui` を作り、生成された構成を報告に書く。
- [ ] **Step 2:** 失敗するテストを書く: `test("primary solid button uses the brand color")`（`colorScheme="primary"` の solid のボタンの背景色が、ライトで `#bf0000`、ダークで `#a30000`）、`test("point tokens resolve in both themes")`。
- [ ] **Step 3:** テーマを実装し、`__root.tsx` を `UIProvider` で包む。
- [ ] **Step 4:** テストと `pnpm check:all`、`pnpm build` を通す。Commit `feat(ui): add Yamada UI workspace package with point sprint theme`。

---

### Task 3: 排他の SPU（domain）

**Files:** `packages/domain/src/benefit-kinds/index.ts`、`master/spu.ts`、`plan-ops/benefit-ops.ts`（新規）、`index.ts`。Test: `plan-ops/benefit-ops.test.ts`、`master/master.test.ts`

**Interfaces:**
- `BenefitSchema` の共通フィールドに `exclusiveGroup: v.optional(v.pipe(v.string(), v.minLength(1)))` を足す。
- `standardSpu` に「楽天プレミアムカード」（楽天カード特典分と同じく `rate: 1`、税抜、`roundingUnit: "order"`、`capScope: "month"`、`cap: 5000`、既定 OFF）を足し、楽天カード特典分と同じ `exclusiveGroup: "rakuten-card"` を付ける。出典は設計書3節の SPU のページ。
- `toggleBenefit(plan: Plan, benefitId: string): Plan`: その特典の `enabled` を反転する。有効にしたときは、同じ `exclusiveGroup` のほかの特典を無効にする。`plan` は変更しない。見つからなければ例外。

- [ ] **Step 1:** 失敗するテスト: `test("enabling premium card disables the regular card SPU")`、`test("disabling does not touch the group")`、`test("toggle does not mutate the plan")`、`test("premium card SPU has a 5,000 point monthly cap")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(domain): add exclusive benefit groups and premium card SPU`。

---

### Task 4: リポジトリ（IndexedDB とメモリ）

**Files:** `apps/web/src/storage/repository.ts`、`memory-repository.ts`、`indexed-db-repository.ts`。Test: `indexed-db-repository.test.ts`、`memory-repository.test.ts`

**Interfaces:**
```ts
interface Repository {
  plans: { list(): Promise<Plan[]>; get(id: string): Promise<Plan | undefined>; put(plan: Plan): Promise<void>; delete(id: string): Promise<void> };
  shops: { list(): Promise<Shop[]>; put(shop: Shop): Promise<void> };
  profile: { get(): Promise<Profile | undefined>; put(profile: Profile): Promise<void> };
  quarantined(): Promise<number>;
  wasReset(): boolean;
}
createMemoryRepository(initial?: { plans?: Plan[]; shops?: Shop[]; profile?: Profile }): Repository
createIndexedDbRepository(options?: { name?: string }): Repository   // 既定 "point-sprint"
```
- Seitu の `createIndexedDb` と `createIndexedDbTable` を使う。`plans`・`shops` は `keyPath: "id"`、`profile` は out-of-line のキー `"profile"` の1行、`quarantine` は `autoIncrement` で `{ store, value, issues }`。
- 各テーブルの `schema` に `PlanSchema`・`ShopSchema`・`ProfileSchema`。`onValidationError` は元の値を `quarantine` に書いてから行を捨てる。
- `onUpgrade` で `oldVersion` から `CURRENT_SCHEMA_VERSION` まで、各行に `migrateRow` を適用する。
- 移行に失敗してデータベースが使えないとき（読み書きが reject）は、削除して作り直し、以後 `wasReset()` が `true`。
- Seitu の `query()` と React 向けの部品は使わない。API は `node_modules/seitu/skills/` の同梱ドキュメントに従う。

- [ ] **Step 1:** 失敗するテスト（node 環境、`fake-indexeddb/auto`、テストごとに別の DB 名）: `test("round-trips plans, shops and profile")`、`test("put rejects an invalid plan")`、`test("invalid stored rows are quarantined and skipped")`、`test("memory repository behaves like the IndexedDB one")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add repository with IndexedDB (Seitu) and memory implementations`。

---

### Task 5: 状態（TanStack Query と Jotai）

**Files:** `apps/web/src/state/*`、`apps/web/src/app-providers.tsx`、`__root.tsx`。Test: `apps/web/src/state/state.test.ts`

**Interfaces:**
- `queryKeys = { plans: ["plans"], shops: ["shops"], profile: ["profile"] } as const`
- `repositoryAtom`（`AppProviders` が `createIndexedDbRepository()` を入れる。テストはメモリ実装）
- `plansQueryAtom`・`shopsQueryAtom`・`profileQueryAtom`（`atomWithQuery`）。プロフィールが未保存なら `{ spuBenefits: standardSpu, updatedAt: <今> }`。
- `plansAtom`・`shopsAtom`・`profileAtom`（各クエリの `data`。未取得の間は空配列か既定値）
- `savePlanAtom`・`deletePlanAtom`・`saveShopAtom`・`saveProfileAtom`（`atomWithMutation`、`onMutate` で先にキャッシュを書き換え、失敗したら戻し、`onSettled` で無効化。保存時に `updatedAt` を現在時刻にする）
- `calculationAtom = atom((get) => calculateAll(get(plansAtom), get(shopsAtom)))`
- `planAtom`・`planResultAtom`（`atomFamily((id: string) => …)`）、`orderPointsAtom`（`atomFamily(({ planId, orderId }) => …)`: その注文の商品の内訳の行と合計）。派生 atom には `selectAtom` と要素ごとの等価判定を付け、値が変わらなければ再描画しない。
- 注文の操作のヘルパ（`savePlanAtom` を通す）: `addOrder`、`updateOrder`、`removeOrder`、`copyOrderInPlan`（domain の `copyOrder`）、`moveOrderInPlan`（`moveOrder`）、`toggleHold`、`toggleBenefitInPlan`（`toggleBenefit`）。
- `ui.ts`: 開いている注文の ID（スマホは同時に1件）、内訳の展開、並べ替えモードなど UI の一時的な状態だけ。

- [ ] **Step 1:** 失敗するテスト（Jotai の `createStore` とメモリ実装）: `test("savePlan updates the cache before the repository resolves")`、`test("failed save rolls back")`、`test("calculation reflects saved orders")`、`test("order points atom keeps identity when another order changes")`、`test("copy inserts the order right after the original")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add query and jotai state with optimistic mutations`。

---

### Task 6: プラン一覧（`/`、アートボード `PlanList`）

**Files:** `apps/web/src/features/plan-list/*`、`routes/index.tsx`。Test: `plan-list.browser.test.tsx`

**画面:** 開催中・開催予定の公式イベント（`officialEvents` のうち終了日が今日以降）をカードで案内し、「このイベントでプランを作る」で `createPlan` してホームへ移る。「イベントを選ばずにプランを作る」も置く。プランの一覧（名前、期間、店舗数、注文数、合計ポイント）、各行の削除（確認を挟む）。ヘッダーにプロフィールへのリンク。保存先の注意書きとフッターのリンクの置き場所。イベントのカードはデータを読まないので事前レンダリングに含める。

- [ ] **Step 1:** 失敗するテスト（ブラウザモード、メモリ実装）: `test("creates a plan from an official event and navigates to it")`、`test("creates a plan without an event")`、`test("lists plans with their totals")`、`test("deletes a plan after confirmation")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` と `pnpm build` を通す。
- [ ] **Step 5:** Commit `feat(web): add plan list`。

---

### Task 7: サマリーカードと結果（アートボード `Main` と `Desktop` の右カラム）

**Files:** `features/plan-home/summary-card.tsx`、`point-breakdown.tsx`、`warnings.tsx`、`shop-ladder.tsx`、`bottom-bar.tsx`、`routes/plan.tsx`。Test: `summary-card.browser.test.tsx`、`shop-ladder.browser.test.tsx`

**画面:**
- ヘッダー: プラン名（押すとプランを切り替える。一覧へのリンクと他のプラン）と、プランの設定へのボタン。
- サマリーカード（`primary.solid` の面）: 獲得予定ポイント（`total`）、実質還元率（`total` ÷ 保留を除く税込の対象額の合計）、10個の買いまわりドット（`shopAroundOutlook.shopCount`）、「◯店舗を買い回り中」「マラソン +◯倍」、`nextShop` があるときだけ「あと1店舗で全商品 +◯倍（約 +◯P）」、上限ゲージ（マラソン区分のポイント / `cap`）と「上限まであと 約◯万円 買えます（税込・概算）」（`rows` の現在の行の `remainingTaxIncludedApprox`）。「ポイントの内訳を見る」で `bg.panel` の小さなパネルに `point-breakdown`（`groupTotals`）を開く。
- `point-breakdown`: 4区分の積み上げバーと凡例。順番と見た目は文書どおり（キャンペーンは斜線）。商品ごとの内訳でも同じ部品を使う。
- 警告（`warnings`）: 台帳にないショップ、期間外の注文、共有する上限の食い違い、読み込めなかったデータ。
- 「あと何店舗回る？」（`shopAroundOutlook.rows`）: 店舗数・倍率・残額・横棒、現在の行を強調。スマホではサマリーカードに1行、展開で全体。PC では右カラム。
- スマホ下部の固定バー: 合計金額・店舗数、獲得ポイント・還元率、「注文を追加」。
- 買いまわりの特典がないプランでは、ドット・ゲージ・ヒント・一覧を出さない。

- [ ] **Step 1:** 失敗するテスト: `test("shows total and effective rate")`、`test("shows next shop hint only below the top tier")`、`test("breakdown opens and sums to total")`、`test("hides shop-around parts when the plan has none")`、`test("highlights the current shop count row")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add summary card, breakdown and shop ladder`。

---

### Task 8: スマホの注文カード（アートボード `Main`）

**Files:** `features/plan-home/order-list.tsx`、`order-card.tsx`。Test: `order-card.browser.test.tsx`

**画面:** 見出し「注文 ◯件（保留 ◯）」、並べ替えとリセット。閉じたカード: 順番バッジ（保留中は「保留」）、ショップ名と注文日、商品名（2件以上は「他◯点」）、金額・税率・キャンペーンのバッジ、獲得ポイントと合計倍率、開閉の矢印。開いたカード（同時に1枚）: 商品の一覧、税抜の基準額、内訳の行（項目・倍率・ポイント）、「買い回りにカウント（オフで保留）」のトグル、編集・コピー・削除。保留中は点線の枠、ポイントは `heldEstimates` の値に取り消し線。並べ替えモードでは各カードに上へ・下へのボタン（キーボードで操作できる）。

- [ ] **Step 1:** 失敗するテスト: `test("only one card is open at a time")`、`test("hold toggle moves the order out of the shop count")`、`test("held card shows the estimate struck through")`、`test("copy adds the order right after")`、`test("move up and down in reorder mode")`、`test("editing one order does not re-render other order cards")`（`React.Profiler` の `onRender` で描画回数を数える）。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add mobile order cards with hold, copy and reorder`。

---

### Task 9: PC の注文リスト（アートボード `Desktop`）

**Files:** `features/plan-home/order-table.tsx`（PC の注文リスト）、`order-row.tsx`、`routes/plan.tsx`（2カラム）。Test: `order-table.browser.test.tsx`

**画面:** 1024px 以上で、左が注文リスト、右がサマリー（約340px）の2カラム。狭いときは右を下へ回り込ませる。**表のように横幅を要求する作りにはしない。** どの幅でも横スクロールなしで収まること。
- 行（閉じた状態）: ドラッグハンドル、カウント（チェックボックス = 保留の反転）、店舗番号、ショップ／注文日・商品名・キャンペーンのバッジ（縦に3行）、金額と税率、獲得ポイントと倍率、詳細の開閉。中央の列だけが伸び縮みする。
- 行を開く（アコーディオンで縦に伸びる）: 内訳バーと4区分のポイント、税抜の基準額、編集欄（ショップ、注文日、商品名、金額、税率、ショップ独自倍率）を幅に応じて折り返すグリッドで並べる。39ショップ・リピート購入の切り替え、コピー・削除。
- 一覧の最後の「＋ 注文を追加」を開くと、追加の入力欄（URL、ショップ、注文日、商品名、金額、税率、39ショップ・リピート購入、プレビュー、「追加する」）が縦に並ぶ。Enter で追加し、入力欄を空にして最初の欄にフォーカスする。
- ドラッグでの並べ替えに加え、ハンドルにフォーカスして上下キーでも並べ替えられる。リストの下に注意書き。

- [ ] **Step 1:** 失敗するテスト: `test("enter in the add form adds an order and refocuses the first field")`、`test("keyboard reorder with the handle")`、`test("count checkbox toggles hold")`、`test("expanded row shows group totals and edits the order")`、`test("fits 1024px without horizontal scroll")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add desktop order list`。

---

### Task 10: 注文の追加・編集（アートボード `MobileAdd`）

**Files:** `features/order-editor/*`。Test: `order-editor.browser.test.tsx`

**画面（スマホはボトムシート、PC はダイアログ）:**
- 商品の URL 欄と「貼り付け」: この計画では `parseUrl` でショップコードを取り出し、ショップ台帳と照合して選ぶところまで（API での自動入力は計画3）。
- ショップ（台帳から選ぶ／新しいショップを作る: 名前、購入先、39ショップか）と注文日（既定は今日）。
- 金額（税込、大きな数値入力、開いたら自動でフォーカス）、商品名メモ、税率のセグメント（10% / 8%（食品）/ 非課税）。
- キャンペーン: 切り替えのチップ「39ショップ」（ショップの属性 `39shop` を切り替える）と「リピート購入」（注文の属性 `repeat` を切り替える）。日付で決まるキャンペーンは「日付で自動」として表示だけ。
- プレビュー: 下書きの注文を加えたプランを `calculateAll` で計算し、「この注文で（◯店舗目としてカウント）税抜 ¥◯ × ◯% → ◯P」と、ショップ数が増えるときは「買い回りが +◯倍 になり、ほかの注文も +◯P」。
- 詳細設定（折りたたみ）: 数量、クーポン値引額、ショップ独自倍率、保留、同じショップの商品を追加（Formisch の `FieldArray`）。
- ボタン: 「続けて追加」（保存して入力欄を空にし、シートは開いたまま）と「追加する」。編集のときは「保存する」。
- 値は Valibot の検証を通ったときだけ保存する。検証を通らない間は保存しない。

- [ ] **Step 1:** 失敗するテスト: `test("adds an order and closes")`、`test("continue adding keeps the sheet open and clears the inputs")`、`test("invalid price is not saved")`、`test("tax-exempt item uses the same base amount")`、`test("repeat chip sets the order tag")`、`test("39shop chip marks the shop")`、`test("preview shows the next shop count and points")`、`test("pasting an Ichiba URL selects the matching shop")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add order editor`。

---

### Task 11: プランの設定（`/plan/settings`、アートボード `MobileSettings`）

**Files:** `features/plan-settings/*`、`routes/plan.settings.tsx`。Test: `plan-settings.browser.test.tsx`

**画面:** PC では同じ内容をサイドパネルかモーダルで開く（ヘッダーの「SPU +◯倍・上限 ◯P」のボタンから）。
- SPU: 合計倍率（「SPU を入れて全商品 ◯倍」）と、プランの SPU のタイル（4列、頭文字・倍率・名前、ON は `primary.solid`、OFF は `bg.muted`）。タップで `toggleBenefitInPlan`（排他グループを守る）。上限に達した項目に「上限」のバッジ（その特典の `benefitTotals` の `capReached`）。名前を押すと上限・条件・楽天のページへのリンクを出す。凡例と「楽天で自分のSPUを確認する」。
- キャンペーン: プランのキャンペーン（`category: "campaign"`、`shop-around` を除く）を、名前・倍率・期間の入ったトグルのボタンで並べる。「＋ 追加」でテンプレート（`campaignTemplates` の `user-dates` と `user-period`）を2列で開き、選ぶと日付・倍率・期間・上限などの入力を出して `instantiateCampaign` で追加する。`hasCampaignOccurrence` が真なら追加できない理由を出す。追加したキャンペーンは削除できる。
- 買いまわりと上限: 1行の要約（名前・期間・最大倍率・上限）と「変更」。開くと期間と上限を上書きできる。
- 下部の「保存して計算に反映」（この画面の変更はその都度保存し、ボタンはホームへ戻る）。

- [ ] **Step 1:** 失敗するテスト: `test("tile toggles SPU and updates the total")`、`test("enabling premium card turns off the regular card")`、`test("cap badge appears when the cap is reached")`、`test("adds a sports-win day from the template")`、`test("prevents adding the same 39shop period twice")`、`test("overrides the shop-around cap")`。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` を通す。
- [ ] **Step 5:** Commit `feat(web): add plan settings with SPU tiles and campaigns`。

---

### Task 12: プロフィール（`/profile`）と E2E

**Files:** `features/profile/*`、`routes/profile.tsx`、`apps/web/playwright.config.ts`、`apps/web/e2e/plan-flow.spec.ts`、ルートの `package.json`（`test:e2e`）。Test: `profile.browser.test.tsx`、`e2e/plan-flow.spec.ts`

**画面:** SPU の初期値（プランの設定と同じタイルの部品。ここでの変更はこれから作るプランにだけ反映されると明記）。ショップ台帳（名前、購入先、ショップコード、39ショップか、の一覧と編集）。読み込めなかったデータがある（`quarantined() > 0`）か、データベースを作り直した（`wasReset()`）ときは、ページ上部に表示する。

- [ ] **Step 1:** 失敗するテスト: `test("SPU defaults are saved to the profile")`、`test("marks a shop as 39shop")`、`test("shows a notice when data was quarantined")`。E2E `test("create plan, add order, see points, hold it, reload keeps data")`: トップでプリセットからプランを作り、注文を1件入れる（新しいショップ、税込 3,300円）と結果に通常ポイント 30 が出る。保留にすると合計から外れる。再読み込みしても注文・保留・結果が残る。
- [ ] **Step 2〜4:** 失敗を確かめ、実装し、`pnpm check:all` と `pnpm test:e2e` を通す。
- [ ] **Step 5:** Commit `feat(web): add profile page and end-to-end plan flow`。
