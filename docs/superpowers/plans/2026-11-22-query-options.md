# Query Options Implementation Plan

> **For agentic workers:** Use executing-plans to implement each task in this session.

**Goal:** atom を維持した取得定義の Factory 化と domain の純粋関数の集約を、3 本の Stack PR で届ける。

**Architecture:** Options Factory は Repository または取得関数を受け取り、atom が依存を解決して呼ぶ。単一データの選択と複数状態の合成は派生 atom に残す。

**Tech Stack:** TypeScript、TanStack Query、Jotai、Vitest。

**Spec:** docs/superpowers/specs/2026-11-22-query-options-design.md

## Global Constraints

queryKey と queryFn の上書き API は作らない。保存形式とスキーマ版は変えない。旧 API は呼び出し元を移して削除する。

## Review Focus

- Repository と公式イベント取得元の store ごとの差し替え。
- storageHealth の全取得成功後の実行と更新時刻によるキャッシュ更新。
- アカウント無効・削除時の既定アカウントへの帰属。
- 保留プランと保存済み SPU の計算結果。
- イベントの境界日、候補の曖昧さ、同順位の決定順。

### Task 1: Options Factory

- [x] state/queries.ts、state/sync.ts、routes/-official-events.ts に 9 種類の Factory を定義し、既存 atom を移行する。
- [x] QueryClient からの取得、共有キャッシュ、取得元の差し替え、storageHealth の条件を検証する。
- [x] AGENTS.md に責務と制約を追記する。
- [x] lint、型、書式、スペル、既存テストを検証し、main 向け PR を作る。

### Task 2: プラン計算

- [x] state/accounts.ts を domain/plan-ops/accounts.ts に移し全 import を移行する。
- [ ] toCalculated を domain/plan-ops/calculated-plan.ts の calculatedPlan に移す。
- [ ] 注文明細のポイント選択を domain/calculate/order-points.ts に移す。
- [ ] 純粋関数のテストと既存状態テストを検証し、PR 1 向け PR を作る。

### Task 3: イベント選択

- [ ] endedLatestFirst と候補選択を domain/official-events/selection.ts に移す。
- [ ] start-target.ts には UI の create/choose の変換を残す。
- [ ] 境界日と同順位を含むテスト、全体の検証を行い、PR 2 向け PR を作る。
- [ ] 3 本の差分・CI・Preview を確認し、Stack のリンクを各 PR に記載する。

### PR 1 の追加: Options と atom のモジュール分離

- [x] state/queries.ts を純粋な Options と queryKeys に限定し、atom を state/query-atoms.ts に移す。
- [x] 同期と公式イベントの Factory を hooks や atom と分離し、全 import を移す。
- [x] analyze-query-bundles.ts で同条件のアプリビルドと Factory 単独バンドルを比較し、分析結果を記録する。
- [ ] PR 1 を更新し、PR 2・3 を積み直して全体を検証する。
