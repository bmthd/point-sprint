# 計算方法のページとバージョンつきの変更履歴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初めて来た人が信用できるか判断できるよう、計算方法のページ（`/calculation`）と、バージョンつきのお知らせ、ヘッダーのバージョンの表示を作る。

**Architecture:** 出典と確認日は `packages/domain` のマスタの横に、特典の id から引く表として持つ（保存するデータの形は変えない）。お知らせに `release`（バージョンと、計算が変わるか）を足し、ヘッダーは最新のバージョンのお知らせへリンクする。計算方法のページは既存の Markdown のページに載せ、倍率の表と具体例は、マスタと `calculate` から作った Markdown を本文に差し込む。

**Tech Stack:** TypeScript、TanStack Start / Router、Yamada UI v2（`@workspaces/ui`）、Vitest（単体とブラウザ）

**Spec:** Issue #221（https://github.com/bmthd/point-sprint/issues/221）

## Global Constraints

- 部品は `@workspaces/ui` から選ぶ。色はテーマのトークンで指定する（`docs/design-system.md`）
- 保存するデータの形（`packages/domain/src/model`）は変えない。`CURRENT_SCHEMA_VERSION` は上げない
- 1 ルートだけが使うものはルートの隣に `-` で始まる名前で置く（AGENTS.md）
- バージョンの上げ方: 計算の結果が変わる（`changesCalculation: true`）なら大きい番号（1.4 → 2.0）、ほかは小さい番号（1.4 → 1.5）。最初のバージョンは `1.0`
- ヘッダーの点: 最新のバージョンのお知らせの日から 30 日以内なら緑、過ぎたら灰
- 見た目はテストしない。テストは自分たちの振る舞いだけ

## Review Focus

- ビルドの日（プリレンダー）と開いた日が違う: ヘッダーの点は開いた日で決まる（`useToday`）。プリレンダーの HTML はビルドの日のまま → `isFreshRelease` の境目のテストで押さえる
- バージョンを持つお知らせがない: ヘッダーに何も出さない → `latestRelease` が `undefined` を返すテスト
- 同じ日に 2 件のバージョン: 一覧の並び（`newestFirst`）と同じく、並べた順で後の方が新しいバージョン、とはしない。バージョンの比較は番号で行う → `latestRelease` のテスト
- マスタに項目を足して出典を書き忘れる → `sources.test.ts`
- 具体例の数字が計算とずれる → 具体例の Markdown を `calculate` の結果から作り、合計が一致するテスト

---

### Task 1: 出典と確認日をデータにする

**Files:**
- Create: `packages/domain/src/master/sources.ts`
- Create: `packages/domain/src/master/sources.test.ts`
- Modify: `packages/domain/src/master/spu.ts`、`campaigns.ts`（コメントの「出典」「確認日」を sources.ts への参照に置き換える）
- Modify: `packages/domain/src/index.ts`（export）

**Interfaces:**
- Produces:
  ```ts
  export type BenefitSource =
    | { kind: "official"; title: string; url: string; checkedOn: string } // checkedOn は YYYY-MM-DD
    | { kind: "unofficial"; title: string; url: string; checkedOn: string }
    | { kind: "user-entered" };
  export const spuSource: (benefit: Benefit) => OfficialSource; // SPU はどれも SPU のページ
  export const campaignSources: Readonly<Record<string, BenefitSource>>; // テンプレートの id → 出典
  ```

値（コメントと設計書 3 節から写す）:
- SPU のすべて: 「楽天市場 SPU（スーパーポイントアッププログラム）」 https://event.rakuten.co.jp/campaign/point-up/everyday/point/ 。確認日 2026-10-04、楽天銀行の 2 項目だけ 2026-10-19
- 5と0のつく日: https://event.rakuten.co.jp/campaign/card/pointday/ 2026-10-04
- ご愛顧感謝デー、ワンダフルデー、勝ったら倍、24時間限定、2ショップ購入、超ポイントバック祭: 各コメントの URL と確認日
- 39ショップ: https://event.rakuten.co.jp/guide/freeshippingline/campaign/ 2026-10-04
- リピート購入: `unofficial`、「アプリオ」 https://appllio.com/rakuten-repeat-purchase 2026-10-04
- 買いまわり（手動）、合計額で倍率（手動）、自由な倍率: `user-entered`

- [ ] **Step 1: テストを書く** — `sources.test.ts`
  - `test.each([...standardSpu, ...campaignTemplates.map((t) => t.benefit)])("$label has a source", …)`: `benefitSources[b.id]` が定義されている。`official`/`unofficial` なら `url` が `https://` で始まり、`checkedOn` が実在する日付
  - `benefitSources` のキーがすべてマスタの特典の id（余分がない）
- [ ] **Step 2: 落ちるのを確かめる** — `pnpm --filter @workspaces/domain exec vitest run src/master/sources.test.ts` → FAIL
- [ ] **Step 3: `sources.ts` を書き、コメントの出典を参照に置き換える**
- [ ] **Step 4: 通るのを確かめる** — 同じコマンドで PASS
- [ ] **Step 5: Commit**

### Task 2: お知らせのバージョン

**Files:**
- Modify: `apps/web/src/routes/-notices/notices.ts`、`notices.test.ts`
- Modify: `apps/web/src/routes/(site)/-notices/notices-page.tsx`、`notices.browser.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type Release = { version: string; changesCalculation: boolean };
  export type Notice = { id; date; title; body; release?: Release };
  export type ReleaseNotice = Notice & { release: Release };
  export const nextVersion: (previous: string | undefined, changesCalculation: boolean) => string;
  export const releasesOldestFirst: (list: readonly Notice[]) => ReleaseNotice[]; // バージョンの番号の順
  export const latestRelease: (list: readonly Notice[]) => ReleaseNotice | undefined;
  export const isFreshRelease: (release: ReleaseNotice, today: string) => boolean; // 30 日以内
  export const FRESH_DAYS = 30;
  ```

- [ ] **Step 1: テストを書く** — `notices.test.ts` に足す
  - `nextVersion(undefined, false)` と `nextVersion(undefined, true)` は `"1.0"`。`nextVersion("1.4", false)` は `"1.5"`、`nextVersion("1.4", true)` は `"2.0"`。`nextVersion("1.9", false)` は `"1.10"`
  - `latestRelease`: バージョンのないお知らせを飛ばし、番号の最も大きいものを返す（`"1.10"` は `"1.9"` より新しい）。バージョンが 1 件もなければ `undefined`
  - `isFreshRelease`: 日付 `2026-10-25` のバージョンは、`2026-11-24` で `true`、`2026-11-25` で `false`
  - 実データ: バージョンを持つお知らせを日付の古い順に並べると、各バージョンが `nextVersion(前のバージョン, changesCalculation)` と一致する
- [ ] **Step 2: 落ちるのを確かめる** — `pnpm --filter web exec vitest run src/routes/-notices/notices.test.ts` → FAIL
- [ ] **Step 3: 型と関数を足し、公開のお知らせを足す**
  - `id: "calculation-page"`、`date: "2026-10-25"`、`title: "計算方法のページと変更履歴を始めました"`、`release: { version: "1.0", changesCalculation: false }`。本文は、計算方法のページで倍率と出典を確かめられること、これからは変更をお知らせにバージョンつきで載せること、ヘッダーのバージョンから最新のお知らせへ移れること
  - 「作り直しました」は変えない
- [ ] **Step 4: `/notices` で、バージョンを持つお知らせの日付の横に `Badge variant="outline" colorScheme="gray"` の「Ver.1.0」を出し、`changesCalculation` なら `Badge colorScheme="warning" variant="subtle"` の「計算が変わります」を添える**。ブラウザテスト: バージョンのあるお知らせに「Ver.1.0」が出て、ないお知らせに出ない。`changesCalculation` のお知らせにだけ「計算が変わります」が出る
- [ ] **Step 5: 通るのを確かめる** — `pnpm --filter web exec vitest run src/routes/-notices src/routes/\(site\)/-notices` → PASS
- [ ] **Step 6: Commit**

### Task 3: ヘッダーのバージョンの表示

**Files:**
- Create: `apps/web/src/routes/-root/release-link.tsx`、`release-link.browser.test.tsx`
- Modify: `apps/web/src/routes/-root/site-header.tsx`（カラーモードのボタンの左に置く）

**Interfaces:**
- Consumes: `latestRelease`、`isFreshRelease`（Task 2）、`useToday`（`routes/-use-today.ts`）
- Produces: `export function ReleaseLink({ notices, now }: { notices?: readonly Notice[]; now?: () => Date })`

中身:
- `RouterLink to="/notices" hash={release.id}`、`minH="11"`、`aria-label={`Ver.${version}、${M}月${D}日に更新。更新のお知らせを見る`}`
- 中に `Status as="span" size="sm"`。新しければ `value="success"`、古ければ `colorScheme="gray"`。ラベルは「Ver.1.0」。`today` が `undefined`（テストとプリレンダー前）のときは `import.meta.env.BUILD_DATE` と同じ扱いの `useToday` に任せ、それも `undefined` なら新しいとみなす
- 日付「10/25 更新」は `fg.muted` の `xs`、`lg` 以下は `display="none"`
- バージョンのお知らせがなければ何も描かない

- [ ] **Step 1: ブラウザテストを書く** — `release-link.browser.test.tsx`
  - バージョンを持つお知らせのうち番号の大きい方へリンクする（`href` が `/notices#<id>`）。名前は「Ver.1.1、10月25日に更新。更新のお知らせを見る」
  - バージョンのお知らせがなければ、リンクがない
- [ ] **Step 2: 落ちるのを確かめる** → FAIL
- [ ] **Step 3: `ReleaseLink` を書き、ヘッダーに置く**
- [ ] **Step 4: 通るのを確かめる** → PASS
- [ ] **Step 5: Commit**

### Task 4: 計算方法のページ

**Files:**
- Create: `apps/web/src/markdown/calculation.md`（文章。差し込む位置に `{{example}}`、`{{spu-table}}`、`{{campaign-table}}`、`{{release}}` の行を置く）
- Create: `apps/web/src/routes/(site)/(markdown)/calculation.tsx`
- Create: `apps/web/src/routes/(site)/(markdown)/-calculation-markdown.ts`、`-calculation-markdown.test.ts`
- Modify: `apps/web/src/markdown/help.md`（「サイト利用上の注意事項」を計算方法のページへ移し、リンクを置く）
- Modify: `apps/web/src/routes/-root/site-footer.tsx`（「使い方・注意事項」の後に「計算方法」）
- Modify: `apps/web/src/prerender-pages.ts`（`/calculation`）
- Modify: `apps/web/src/routes/routes.test.ts` は変えない（ルートは型で確かめる）

**Interfaces:**
- Consumes: `benefitSources`（Task 1）、`latestRelease`（Task 2）、`standardSpu`、`campaignTemplates`、`calculate`
- Produces:
  ```ts
  export function calculationMarkdown(template: string): string; // 差し込み済みの Markdown
  export function exampleMarkdown(): { markdown: string; total: number; expectedTotal: number };
  export function spuTableMarkdown(): string;
  export function campaignListMarkdown(): string; // スマホで読めるよう表でなく箇条書き
  ```

文章（`calculation.md`）の節:
1. `# 計算方法`、導入（倍率と上限は楽天の公式ページから写し、出典と確認日を載せている。結果は目安）
2. `## 計算の流れ` — 設計書 3 節「計算が従う楽天の規則」の各項目を、楽天の FAQ・ガイドへのリンクつきで箇条書きにする。続けて `{{example}}`
3. `## 使っている倍率と上限` — `### SPU` `{{spu-table}}`、`### キャンペーン` `{{campaign-table}}`、`### お買い物マラソン`（ショップ数の数え方、回ごとの倍率と上限は楽天の告知ページから自動で集め、トップページのイベントで確かめられること。https://event.rakuten.co.jp/campaign/point-up/marathon/guide/ ）。自分で倍率を入れるキャンペーン（買いまわり（手動）、合計額で倍率（手動）、自由な倍率）は表に載せず一言触れる
4. `## 計算に入れていないもの` — help.md の注意事項（誤差、送料、回ごとの違い）に、支払方法、会員ランク、エントリーの有無は利用者が ON / OFF で切り替えることを足す
5. `## この計算方法のバージョン` — `{{release}}`（「Ver.1.0（2026年10月25日）」とそのお知らせへのリンク、`/notices` へのリンク）

具体例: 楽天市場の 1 ショップ、2026-10-05（5と0のつく日）、税込 5,500 円（税率 10%）の商品 1 つ。通常ポイント、楽天カード通常分、楽天カード特典分、5と0のつく日を ON。表は「特典 | 対象額 | 倍率 | ポイント」で、行は `calculate` の `benefitTotals` から、合計は `total`。

表の列: SPU は「項目 | 倍率 | 上限 | 出典」、キャンペーンは「キャンペーン | 倍率 | 上限 | 出典」。上限は「月 1,000P」のように数え方（`month` 月、`campaign` 開催期間、`occurrence` 開催、`plan` プラン）を前に付け、上限がなければ「なし」。倍率は `rate-bonus` は「+1倍」、`spend-tiers` と `shop-around` は段階を「3,000円以上で+2倍」のように並べる。出典は `[title](url)（YYYY年M月D日に確認）`、`unofficial` は「（楽天の公式ではありません）」を添える。

- [ ] **Step 1: 単体テストを書く** — `-calculation-markdown.test.ts`
  - `exampleMarkdown()` の `total` が 205（税抜 5,000 → 通常 50、カード通常分 55、カード特典分 50、5と0のつく日 50）で、Markdown に「205」が出る
  - `spuTableMarkdown()` に `standardSpu` のすべての `label` が出る。`campaignTableMarkdown()` に `user-entered` 以外のテンプレートの `name` が出て、`user-entered` のものは出ない
  - `calculationMarkdown(raw)` の結果に `{{` が残らない
- [ ] **Step 2: 落ちるのを確かめる** → FAIL
- [ ] **Step 3: 文章と関数とルートを書く**。ルートは `help.tsx` と同じ形で、`context: () => ({ markdown: calculationMarkdown(raw) })`、`pageHead` の題は「計算方法」
- [ ] **Step 4: 通るのを確かめる** → PASS。`pnpm check:all`
- [ ] **Step 5: Commit**

### Task 5: 運用の決まりと仕上げ

**Files:**
- Create: `docs/notices.md`（お知らせの書き方: バージョンを上げるとき、`changesCalculation` の付け方、マスタの倍率を変えたら `sources.ts` の確認日を直すこと）
- Modify: `AGENTS.md`（計算の結果が変わる変更では、バージョンを上げるお知らせを足す、の 1 節）

- [ ] **Step 1: 書く**
- [ ] **Step 2: `pnpm check:all` と `pnpm test:e2e` が通る**
- [ ] **Step 3: ローカルで PC とスマホの幅のヘッダー、`/calculation`、`/notices` を開いて確かめる**
- [ ] **Step 4: Commit**
