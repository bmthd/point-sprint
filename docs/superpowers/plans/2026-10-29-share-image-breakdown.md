# シェア画像の内訳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** シェアの結果画像（OGP、1200×630）を「見出し・獲得ポイント・還元率・内訳の帯・凡例・下の 1 行」の作りにし、URL に内訳とイベントの種類を載せる。

**Architecture:** `ResultFigures` に `breakdown`（4 区分のポイント）と `event`（イベントの種類）を足し、URL のクエリ `base`・`spu`・`marathon`・`campaign`・`event` で読み書きする。`resultCard` は takumi-js のノードを組み直す。プラン画面は `planFigures` に計算結果とプランの `officialEventId` を渡す。

**Tech Stack:** TypeScript、valibot、takumi-js 2.14.0（Worker で WASM）、vitest

**Spec:** Issue #191 のコメント https://github.com/bmthd/point-sprint/issues/191#issuecomment-6472962732 と、Artifact https://claude.ai/artifact/QCDyLrRys9ab3RF87tAUo5 の「B 帯は色だけ、下に凡例」（`project/Legend.dc.html`）

## Global Constraints

- 寸法 1200×630。余白 上 48px・下 44px・左右 64px
- 文字の大きさ: サイト名 30px（太字、左にアイコン 52px、間 16px）、見出し 34px、合計 152px と P 76px、還元率の見出し 28px・値 68px、凡例の名前 26px・ポイント 42px、下の行 24px
- 帯の高さ 44px、角丸 10px、凡例との間 18px。見出しの上 28px、帯の上 28px
- 合計の色は `brand.500`（`#bf0000`）。帯と凡例の色は `point.*` のライトの値: 通常 `gray.300` `#a3a3a3`、SPU `gray.600` `#5c5c5c`、マラソン `brand.500` `#bf0000`、キャンペーン `amber.400` `#f7b23b` と白の 45 度の斜線（プラン画面の `pointFill` と同じ向き）
- 文字色 `#222222`、控えめな文字 `gray.600` `#5c5c5c`、背景 `#ffffff`
- 見出しは「〈イベントの種類〉の獲得ポイント」、イベントなしは「獲得ポイント」。回の名前は出さない
- 区分は 通常 → SPU → マラソン → キャンペーン の順。凡例の名前はプラン画面と同じ（通常・SPU・マラソン・キャンペーン）
- 0P の区分は帯にも凡例にも出さない
- 「獲得予定」は「獲得ポイント」に改める（画像、投稿の文、`/share` の題、画像の代替テキスト）
- 下の 1 行は左に「楽天のポイントを、上限まで計算するツール」（仮の文言）、右にドメイン
- 内訳の 4 つの和が `points` と合わない URL、内訳が欠けた URL は、内訳なしとして帯と凡例を描かない
- export する関数は `function` 宣言、valibot のスキーマは PascalCase（AGENTS.md）
- テストは自分たちの振る舞いだけ。見た目と takumi の機能はテストしない

## 決めたこと（仕様が任せたところ）

- イベントの種類は `EVENT_KINDS = ["marathon", "brand-day"]`。プランの `officialEventId` の接頭辞（`marathon-`、`brand-day-`）から引く。名前は `marathon` → 「お買い物マラソン」、`brand-day` → 「楽天ブランドデー」。D1 にいまある接頭辞はこの 2 つだけなので、スーパーSALE などは #212 で ID の形が決まってから足す。知らない接頭辞は「イベントなし」として扱う
- 凡例は区分の数に関わらず 4 列の幅（各 `(1072 - 3×16) / 4 = 256px`）で左から詰める。列の位置が区分の数で動かない
- 0 区分しかない（内訳の和が 0）ときは帯も凡例も描かない
- 太さは切り出したフォントにある 400 と 700 だけを使う（案の 500 は 400 にする。500 を足すとフォントの容量が増える）
- 合計の文字の大きさ: `size = min(152, floor((1072 - 還元率の幅 - 40) / ((合計の文字数 + 0.5) × 0.6)))`。還元率の幅は `値の文字数 × 0.6 × 68`、還元率がなければ 0。P は `size / 2`

## Review Focus

- 8 桁（99,999,999P）と還元率 100.0% が並んだとき、合計と還元率が重ならない → Task 3 の書き出しで目視
- `points` だけの古い URL（`?points=2600&rate=6.5`）が 404 にならず、帯なしで描ける → Task 1 のテスト `old links without a breakdown still open`
- 内訳の値が一部だけ壊れた URL（`spu=abc`）は内訳ごと捨て、合計と還元率は残す → Task 1 のテスト
- `event` に一覧にない値（`event=<script>`）が来ても見出しに出ない → Task 1 のテスト
- 合計 0P のプラン（何も買っていない）をシェアしても、内訳が URL に載らず画像が崩れない → Task 1 のテスト `planFigures` と Task 3 の書き出し

---

### Task 1: URL の読み書きに内訳とイベントの種類を足す

**Files:**
- Modify: `apps/web/src/routes/-share/result-card.ts`
- Test: `apps/web/src/routes/-share/result-card.test.ts`

**Interfaces:**
- Produces:
  - `export const EVENT_KINDS: readonly ["marathon", "brand-day"]`、`export type EventKind = (typeof EVENT_KINDS)[number]`
  - `export type ResultFigures = { points: number; rate?: number; breakdown?: Record<PointGroup, number>; event?: EventKind }`
  - `ResultSearchSchema` に `base`・`spu`・`marathon`・`campaign`（0 以上の整数、壊れていれば `undefined`）と `event`（`v.picklist(EVENT_KINDS)`、壊れていれば `undefined`）を足す
  - `resultFigures(search)`: 4 区分がそろい、和が `points` と等しいときだけ `breakdown` を持つ。`event` があれば持つ
  - `planFigures(result: { total: number; groupTotals: Record<PointGroup, number> }, rate: string, officialEventId: string | undefined): ResultFigures`。合計が 0 のときは `breakdown` を持たない
  - `export function eventKindOf(officialEventId: string | undefined): EventKind | undefined`
  - `resultPageUrl`・`resultImagePath` は `points`、`rate`、`base`、`spu`、`marathon`、`campaign`、`event` の順でクエリを書く（ないものは書かない）
  - `resultSummary` は「獲得ポイント 2,600P・実質還元率 6.5%」

- [ ] **Step 1: 失敗するテストを書く**

```ts
const breakdown = { base: 100, spu: 500, marathon: 1000, campaign: 1000 };

test("keep a breakdown that adds up to the points, with the event", () => {
  expect(parse({ points: "2600", rate: "6.5", base: "100", spu: "500", marathon: "1000", campaign: "1000", event: "marathon" }))
    .toEqual({ points: 2600, rate: 6.5, breakdown, event: "marathon" });
});
test("drop a breakdown that does not add up or is broken", () => {
  expect(parse({ points: "2600", base: "100", spu: "500", marathon: "1000", campaign: "999" })).toEqual({ points: 2600 });
  expect(parse({ points: "2600", base: "100", spu: "abc", marathon: "1000", campaign: "1000" })).toEqual({ points: 2600 });
  expect(parse({ points: "2600", base: "100", marathon: "1000", campaign: "1500" })).toEqual({ points: 2600 });
});
test("leave out an event that is not one of the kinds", () => {
  expect(parse({ points: "2600", event: "<script>" })).toEqual({ points: 2600 });
});
test("old links without a breakdown still open", () => {
  expect(parse({ points: "2600", rate: "6.5" })).toEqual({ points: 2600, rate: 6.5 });
});
test("of a plan carry its breakdown and its event's kind", () => {
  expect(planFigures({ total: 2600, groupTotals: breakdown }, "6.5", "marathon-2026-10-24"))
    .toEqual({ points: 2600, rate: 6.5, breakdown, event: "marathon" });
  expect(planFigures({ total: 0, groupTotals: { base: 0, spu: 0, marathon: 0, campaign: 0 } }, "—", undefined))
    .toEqual({ points: 0 });
});
test("an event's kind comes from the prefix of its id", () => {
  expect(eventKindOf("marathon-2026-10")).toBe("marathon");
  expect(eventKindOf("brand-day-2026-10-20")).toBe("brand-day");
  expect(eventKindOf("super-sale-2026-12-04")).toBeUndefined();
  expect(eventKindOf(undefined)).toBeUndefined();
});
test("links carry the breakdown and the event and read back the same", () => {
  const figures = { points: 2600, rate: 6.5, breakdown, event: "marathon" } as const;
  expect(resultImagePath(figures)).toBe("/share/image.png?points=2600&rate=6.5&base=100&spu=500&marathon=1000&campaign=1000&event=marathon");
  // round trip through resultPageUrl → parse equals figures
});
```

既存の `planFigures` のテストと `resultSummary` のテストを新しい形と「獲得ポイント」に書き換える。

- [ ] **Step 2: 走らせて失敗を確かめる** — `pnpm --filter web exec vitest run src/routes/-share/result-card.test.ts`（期待: 新しいテストが FAIL）
- [ ] **Step 3: 実装する**（`breakdown` は `POINT_GROUPS` で回す。和の検査は `resultFigures` の中）
- [ ] **Step 4: 走らせて通るのを確かめる**（同じコマンドで PASS）
- [ ] **Step 5: プラン画面と投稿の文を合わせる** — `plan-home.tsx` の `planFigures(...)` を `planFigures(result, effectiveRate(...), plan.officialEventId)` にする。`share-target.test.ts` の「獲得予定」を「獲得ポイント」に直し、`pnpm --filter web exec vitest run src/routes/-share` が通る
- [ ] **Step 6: コミット**

### Task 2: 画像を帯と凡例の作りにする

**Files:**
- Modify: `apps/web/src/routes/-share/result-card.ts`（`resultCard`）
- Modify: `apps/web/src/routes/-share/card-glyphs.ts`
- Test: `apps/web/src/routes/-share/result-card.test.ts`

**Interfaces:**
- Consumes: Task 1 の `ResultFigures`、`EVENT_KINDS`
- Produces: `export function resultHeading(event: EventKind | undefined): string`（「お買い物マラソンの獲得ポイント」/「獲得ポイント」）。`resultCard(figures): Node` は Global Constraints の寸法で組む。アイコンは `public/icon.svg` と同じ SVG を data URI の `image` ノードで置く

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("the heading names the event's kind", () => {
  expect(resultHeading("marathon")).toBe("お買い物マラソンの獲得ポイント");
  expect(resultHeading("brand-day")).toBe("楽天ブランドデーの獲得ポイント");
  expect(resultHeading(undefined)).toBe("獲得ポイント");
});
test("the card leaves out groups with no points", () => {
  const card = resultCard({ points: 1500, breakdown: { base: 0, spu: 500, marathon: 1000, campaign: 0 } });
  expect(texts(card)).toEqual(expect.arrayContaining(["SPU", "マラソン", "500P", "1,000P"]));
  expect(texts(card)).not.toContain("通常");
  expect(texts(card)).not.toContain("キャンペーン");
});
test("draws only letters the fonts are cut down to", () => {
  // EVENT_KINDS のすべてと undefined、4 区分そろった内訳、還元率ありで組んだカードの文字が cardGlyphs にある
});
```

- [ ] **Step 2: 走らせて失敗を確かめる**
- [ ] **Step 3: `resultCard` を組み直し、`cardGlyphs` に新しい文字（通常 SPU マラソン キャンペーン 楽天ブランドデー 還元率 下の行の文言 など）を足し、使わなくなった文字を外す**
- [ ] **Step 4: 走らせて通るのを確かめる**
- [ ] **Step 5: コミット**

### Task 3: 実寸の PNG を書き出して目で確かめる

**Files:** なし（スクラッチパッドのスクリプトだけ）

- [ ] **Step 1: 開発サーバー（`pnpm --filter web dev --port 5183`）から `/share/image.png?...` を取り、次の 5 つを書き出す**: 内訳あり（4 区分、マラソン）、0P の区分あり（通常とキャンペーンが 0、ブランドデー）、8 桁（99,999,999P、還元率 100.0%）、イベントなし、古い URL（`points` と `rate` だけ）
- [ ] **Step 2: 1 枚ずつ開き、重なり・はみ出し・豆腐（字の抜け）がないか見る。崩れたら Task 2 に戻って直す**
- [ ] **Step 3: 開発サーバーを止める**
- [ ] **Step 4: 型・lint・テスト（`pnpm check:all` 相当）を通してコミット**
