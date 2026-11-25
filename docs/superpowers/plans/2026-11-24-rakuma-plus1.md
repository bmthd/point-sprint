# ラクマ購入 +1倍 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公式の大型イベントのプランに「ラクマ購入 +1倍」を OFF で置き、ON にすると 1,000円以上買ったショップの注文に +1倍（上限500ポイント）が付く。

**Architecture:** domain に「ラクマ購入」の特典を作る関数を置き、`createPlan` と `attachToEvent` が公式イベントのプランに足す（5と0のつく日と同じく ON・OFF を引き継ぐ）。条件に `minShopAmount` を足し、計算はショップごとの期間中の合計で注文を外す。作成済みのプランは版16の移し替えで足す。

**Tech Stack:** TypeScript、valibot、vitest、React（Yamada UI）

**Spec:** https://github.com/bmthd/point-sprint/issues/341#issuecomment-7128857712

## Global Constraints

- 倍率 +1、上限 500、`amountBasis: "tax-excluded"`、`capScope: "campaign"`、channels は楽天市場・楽天ブックス・楽天Kobo
- `sharedKey` は `rakuma:<イベントのid>`、期間はイベントの期間（`dateRule: range`）
- 1ショップの期間中の合計（税込、`SHOP_AROUND_MIN_AMOUNT` と同じ数え方）が 1,000円以上の注文だけが対象
- 「買いまわり（手動）」のプランには付けない
- `CURRENT_SCHEMA_VERSION` を 16 に上げる
- 出典の URL と確認日をコメントに書く

## Review Focus

- 同じショップの 600円と 500円の注文（合計 1,100円）は両方とも対象になる
- 1,000円未満のショップの注文は、ほかのショップが対象でも外れる
- ON にしたプランをほかのイベントにつなぎ直すと、ON のまま期間と sharedKey が新しいイベントになる
- イベントのないプランにつなぐ前の移し替えでは足さない（`officialEventId` がない）
- 移し替えをすでに足したプランにもう一度かけても、2つにならない

---

### Task 1: 条件 `minShopAmount` と計算

**Files:**
- Modify: `packages/domain/src/model/common.ts`（`ConditionsSchema` に `minShopAmount`）
- Modify: `packages/domain/src/calculate/calculate.ts`（`eligibleItems`）
- Test: `packages/domain/src/calculate/calculate.test.ts`

**Interfaces:**
- Produces: `Conditions.minShopAmount?: number`（0以上の整数）

- [ ] テスト「minShopAmount leaves out the orders of shops below it over the benefit's days」: 同じショップに 600円と 500円、別のショップに 800円の注文。rate-bonus（rate 1、minShopAmount 1000）は最初のショップの2注文だけにポイントを付ける
- [ ] 失敗を確かめる: `pnpm exec vitest run packages/domain/src/calculate/calculate.test.ts`
- [ ] 実装: `eligibleItems` で、条件に合う注文のショップごと（ショップのない注文は注文ごと）の税込合計を先に出し、`minShopAmount` に届かない注文を外す
- [ ] 通ることを確かめてコミット

### Task 2: ラクマ購入の特典を公式イベントのプランに足す

**Files:**
- Create: `packages/domain/src/master/rakuma.ts`、`rakuma.test.ts`
- Modify: `packages/domain/src/master/create-plan.ts`、`packages/domain/src/plan-ops/attach-event.ts`、`packages/domain/src/index.ts`

**Interfaces:**
- Produces: `rakumaBenefit(event: { id: string; period: Period }, id: Id): Benefit`、`isRakumaBenefit(benefit: Benefit): boolean`、`withRakuma(benefits: Benefit[], kept: Benefit | undefined, event, newId): Benefit`

- [ ] テスト: `createPlan` に event を渡すと OFF のラクマ購入が1つ付き、event なしでは付かない。`attachToEvent` で ON のまま、期間と sharedKey が新しいイベントになる
- [ ] 実装して通し、コミット

### Task 3: 移し替え（版16）

**Files:**
- Create: `packages/domain/src/migrations/v16-rakuma.ts`、`v16-rakuma.test.ts`
- Modify: `packages/domain/src/migrations/index.ts`

- [ ] テスト: `officialEventId` のあるプランに OFF で足す（id はプランの id から決まる10文字）。ないプラン、すでにあるプランは変えない。結果が `PlanSchema` を通る
- [ ] 実装して通し、コミット

### Task 4: キャンペーンの一覧

**Files:**
- Modify: `apps/web/src/routes/(plan)/-plan-settings/campaign-toggles.tsx`（`isAddedCampaign` がラクマ購入を false にする）

- [ ] 画面で、ブラックフライデーのプランに「ラクマ購入 +1倍」の行が出て、✎ が出ないことを見る
- [ ] `pnpm check:all` を通してコミット
