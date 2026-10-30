# トップの LP 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** トップ（`/`）を、何ができるサイトかが最初にわかる LP の形にし、ヘッダーに買い物ガイドとヘルプへのリンクを置く。

**Architecture:** トップの部品は `routes/(site)/-top/`（今の `-plan-list/` を改名）に置く。ヒーロー、使い方、ガイドのカードを足し、今のイベント欄とプラン欄は並べ替えて残す。「計算をはじめる」の行き先は React に依存しない関数で決め、単体テストで固める。トップは右のサイドバーを使わず、お知らせとシェアをページの下に置く。

**Tech Stack:** React、TanStack Router / Start、Yamada UI v2（`@workspaces/ui`）、jotai、Vitest（browser モード）、Playwright。

**Spec:** https://github.com/bmthd/point-sprint/issues/265 （見た目は Artifact https://claude.ai/artifact/RcYP1uoST9F3qEy7aHgnWa の「A. LP 型」）

## Global Constraints

- AGENTS.md に従う。部品は Yamada UI から探し、色はテーマのトークンで指定する（`docs/design-system.md`）
- export する関数は `function` 宣言。ルートの `component` は名前付きの関数を参照する
- h1: 「楽天お買い物マラソンのポイント計算ツール」
- h1 の下: 「何店舗・いくら買えば上限に届くか、買う前にわかる」
- 説明文: 「買うものを入れるだけで、買いまわりの倍率、SPU、上限まで含めたもらえるポイントと、あと何店舗回ればいいかを計算します。無料・登録不要。」
- ボタン: 「計算をはじめる」（`colorScheme="primary"`）、「はじめての方へ」（`variant="outline"`）
- 並び: ヒーロー → 自分のプラン（1 件以上のときだけ）→ イベント → 使い方 → 買い物ガイド → お知らせ・シェア
- 中身の幅は `maxW="1120px"`、左右の余白はほかのページと同じ `px="md"`
- タップ領域は 44px 以上（ボタンは `size="lg"`）
- 見た目そのものはテストしない（ユーザーが確かめる）。テストは振る舞いだけ

## Review Focus

- イベントの読み込み中・読み込みに失敗したときに「計算をはじめる」を押す → イベント欄へ移る（プランは作らない）
- 開催中がなく開催予定だけがある時期 → 開催予定が 1 件ならそれでプランを作る
- 「計算をはじめる」で作るプランの名前がすでにある → 今と同じ「同じ名前のプランがあります」の確認が出る
- 終了したイベントが 1 件だけの時期 → 「そのほかの終了したイベント」のリンクを出さない
- プランを全部消した → 「自分のプラン」の欄ごと消える（見出しだけ残らない）

---

### Task 1: 「計算をはじめる」の行き先を決める関数

**Files:**
- Rename: `apps/web/src/routes/(site)/-plan-list/` → `apps/web/src/routes/(site)/-top/`（`git mv`。中のファイル名と import も直す。`plan-list.tsx` → `top-page.tsx`、`PlanList` → `TopPage`、`plan-list.browser.test.tsx` → `top-page.browser.test.tsx`。`index.tsx` の import も）
- Create: `apps/web/src/routes/(site)/-top/start-target.ts`
- Test: `apps/web/src/routes/(site)/-top/start-target.test.ts`

**Interfaces:**
- Produces: `export type StartTarget = { kind: "create"; event: OfficialEvent } | { kind: "choose" }` と `export function startTarget(events: OfficialEvent[] | undefined, today: string | undefined): StartTarget`

決め方: `events` か `today` がなければ `choose`。開催中（`start <= today <= end`）が 1 件以上ならそれが候補、なければ開催予定（`start > today`）、なければ直近に終わった 1 件（`end` が一番新しいもの）。候補が 1 件なら `create`、0 件か 2 件以上なら `choose`。

- [ ] **Step 1: 改名して、既存のテストが通ることを確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top"`
Expected: PASS（中身は変えていない）

- [ ] **Step 2: 失敗するテストを書く**

`start-target.test.ts` に、`marathon()` に相当する最小の `OfficialEvent` を作る関数を置き、次を確かめる（today は `"2026-10-05"`）。

- `startTarget(undefined, "2026-10-05")` → `{ kind: "choose" }`
- `startTarget(events, undefined)` → `{ kind: "choose" }`
- 開催中 1 件（10/04〜10/09）＋開催予定 1 件 → `{ kind: "create", event: 開催中のもの }`
- 開催中 2 件 → `{ kind: "choose" }`
- 開催中なし、開催予定 1 件 → `{ kind: "create", event: 開催予定のもの }`
- 開催中なし、開催予定 2 件 → `{ kind: "choose" }`
- 終了だけ 2 件（9/19〜9/24 と 9/04〜9/09）→ `{ kind: "create", event: 9/19〜9/24 のもの }`
- `[]` → `{ kind: "choose" }`

- [ ] **Step 3: 失敗を確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/start-target.test.ts"`
Expected: FAIL（`startTarget` がない）

- [ ] **Step 4: `startTarget` を書く**

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/start-target.test.ts"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A "apps/web/src/routes/(site)"
git commit -m "トップの部品を -top にまとめ、「計算をはじめる」の行き先を決める関数を足す"
```

### Task 2: イベントがない時期の「前回のイベント」

**Files:**
- Modify: `apps/web/src/routes/(site)/-top/event-section.tsx`
- Test: `apps/web/src/routes/(site)/-top/top-page.browser.test.tsx`

**Interfaces:**
- Produces: `EventSection` の `section` に `id="events"` を付ける（Task 3 のスクロール先）。`OlderEvents` に `label: string` を足し、今の呼び出しは `label="もっと見る"` にする

開催中・開催予定が 1 件以上あるときは今のタブのまま。0 件で終了が 1 件以上あるときは、タブを出さずに次を出す。

- 見出し `h2`「前回のイベント」と、その横に `fg.muted` で「次回の日程は未発表です」
- 直近に終わったイベントの `EventCard` を 1 枚。ボタンの文言だけ「この条件で計算してみる」にする（`EventCard` に `actionLabel` を足し、初期値は「このイベントでプランを作る」）
- 残りの終了したイベントが 1 件以上なら `OlderEvents` を `label={\`そのほかの終了したイベント（${n} 件）\`}` で出す。引き出しには残りを月ごとに並べる（30 日の区切りは使わない）

- [ ] **Step 1: 失敗するテストを書く**

既存の `"opens the ended events when no event is ahead, and says so on the other tab"` を、次の 2 本に置き換える。

`"shows the latest ended event when none is ahead, and plans with its terms"`: `servedEvents.slice(0, 1)` に、9/04〜9/09 の「お買い物マラソン第一弾」を足して読ませる。

- `getByRole("heading", { name: "前回のイベント" })` が見える
- `getByText("次回の日程は未発表です")` が見える
- `getByRole("tab")` が 0 件
- 「この条件で計算してみる」を押すと `/plan` へ進み、作ったプランの `officialEventId` が `"marathon-2026-09-19"`
- 「そのほかの終了したイベント（1 件）」を押すと引き出しに「お買い物マラソン第一弾」がある

`"does not offer the other ended events when there is only one"`: `servedEvents.slice(0, 1)` だけ。「そのほかの終了したイベント」を含むボタンが 0 件。

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/top-page.browser.test.tsx"`
Expected: 新しい 2 本が FAIL

- [ ] **Step 3: `event-section.tsx` を直す**

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/top-page.browser.test.tsx"`
Expected: PASS（30 日より前を「もっと見る」に置くテストなど、開催予定がある状態のテストも通ったまま）

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/routes/(site)/-top"
git commit -m "開催中・開催予定のイベントがない時期は、前回のイベントを 1 件だけ見せる"
```

### Task 3: ヒーローと「計算をはじめる」

**Files:**
- Create: `apps/web/src/routes/(site)/-top/hero.tsx`
- Modify: `apps/web/src/routes/(site)/-top/top-page.tsx`
- Test: `apps/web/src/routes/(site)/-top/top-page.browser.test.tsx`

**Interfaces:**
- Consumes: `startTarget`（Task 1）、`EventSection` の `id="events"`（Task 2）
- Produces: `export function Hero({ onStart, disabled }: { onStart: () => void; disabled: boolean })`

`Hero` は Global Constraints の文言を出す。「はじめての方へ」は `href="#how-to"` のリンク（Task 4 の使い方の `id`）。PC では右に計算結果の見本を置く。見本は `Card`（`variant="solid"`、`colorScheme="primary"`）で「獲得予定」「4,820P」「8 / 10 店舗・上限まであと 2,180P」と、見本であることを示す「画面の見本」を出す。プランの画面のサマリーカードは使わない（プランと計算結果が要るため）。スマホでは見本を説明文の下に置く。

`TopPage` は `officialEventsAtom` と `today` から `startTarget` を求め、`onStart` で次をする。

- `create`: 今の `request(event)` を呼ぶ（同じ名前のプランがあれば確認が出る）
- `choose`: `document.getElementById("events")` へ `scrollIntoView` し、その見出しにフォーカスを移す

`TopPage` は `PageWithSidebar` をやめ、`Hero` を幅いっぱいの帯（`bg="bg.panel"`、下に枠線）で置き、その下に `maxW="1120px"` の列を置く。この Task では列にイベント欄とプラン欄を今の順で入れる（並べ替えは Task 4）。

- [ ] **Step 1: 失敗するテストを書く**

- `"names the tool in the top heading"`: `getByRole("heading", { level: 1, name: "楽天お買い物マラソンのポイント計算ツール" })` が見える
- `"starts a plan for the one event running"`: 今の `servedEvents`（開催中 1 件）で「計算をはじめる」を押すと `/plan` へ進み、`officialEventId` が `"marathon-2026-10"`
- `"asks before starting a plan whose name is taken"`: 「10月 お買い物マラソン&ジャンル祭」のプランを置いて「計算をはじめる」を押すと、`getByRole("dialog", { name: "同じ名前のプランがあります" })` が出る
- `"takes the visitor to the events when two are running"`: 10/04〜10/09 を 2 件にして押すと、`/` のままで、プランは作られず、`getByRole("heading", { name: "イベント" })` にフォーカスがある
- `"takes the visitor to the events while they cannot be read"`: `load` が失敗する source で押すと、`/` のままでプランは作られない

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/top-page.browser.test.tsx"`
Expected: 新しいテストが FAIL

- [ ] **Step 3: `hero.tsx` を書き、`top-page.tsx` に組み込む**

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/routes/(site)/-top"
git commit -m "トップにヒーローを置き、「計算をはじめる」でイベントのプランを作るか、イベント欄へ移る"
```

### Task 4: 並べ替えと、使い方・買い物ガイド・お知らせ・シェア

**Files:**
- Create: `apps/web/src/routes/(site)/-top/how-to.tsx`
- Create: `apps/web/src/routes/(site)/-top/guide-cards.tsx`
- Modify: `apps/web/src/routes/(site)/-top/top-page.tsx`、`apps/web/src/routes/(site)/-top/plan-section.tsx`、`apps/web/src/routes/(site)/index.tsx`
- Test: `apps/web/src/routes/(site)/-top/top-page.browser.test.tsx`、`apps/web/e2e/sidebar.spec.ts`、`apps/web/e2e/guides.spec.ts`

**Interfaces:**
- Produces: `export function HowTo()`（`section` に `id="how-to"`、見出し `h2`「使い方」）、`export function GuideCards({ articles }: { articles: Article[] })`（見出し `h2`「買い物ガイド」）
- `TopPage` は `articles: Article[]` を props で受ける。`index.tsx` は `loader: () => loadArticles()` を足し、`component` を名前付きの関数 `TopRoute`（`<TopPage articles={Route.useLoaderData()} />`）にする

並び: 自分のプラン → イベント → 使い方 → 買い物ガイド → お知らせとシェア（`NoticeHeadlines` と `ShareSection` を PC は 2 列、スマホは 1 列）。

- `PlanSection`: 見出しを「自分のプラン」にする。読み込んで 0 件なら何も出さない（「まだプランがありません」の文はやめる）。`ClientOnly` の `fallback` は `null`
- `HowTo`: 3 枚のカード。PC は 3 列、スマホは 1 列。番号、見出し、文:
  1. 「イベントを選ぶ」「お買い物マラソンなど、参加するセールを選びます。倍率と上限は自動で入ります。」
  2. 「買うものを入れる」「ショップと金額を入れます。商品の URL を貼ると自動で埋まります。」
  3. 「ポイントと残りがわかる」「もらえるポイント、上限までの残り、あと何店舗回るかが出ます。」
- `GuideCards`: 新しい順に 4 件。カードはタイトルと `description`（2 行で切る）。PC は 2 列、スマホは 1 列。リンクは `GuideList` と同じく `LinkBox.Overlay href`（ページを読み込む）。最後に「すべての記事」（`/guides`）
- 「イベントを選ばずにプランを作る」は今のままイベント欄の下に残す

- [ ] **Step 1: 失敗するテストを書く**

`renderPlanList` を `renderTopPage` に改名し、`articles` に 5 件の `Article` を渡す。ヘルパーの `planRows` は `getByRole("region", { name: "自分のプラン", exact: true })` にする。

- `"hides its plans section until there is a plan"`: プランなしで `getByRole("region", { name: "自分のプラン" })` が 0 件。`"deletes a plan after confirmation"` の最後で、欄ごと消えたことも確かめる
- `"lists the four newest guides"`: `getByRole("region", { name: "買い物ガイド" }).getByRole("link")` が、新しい 4 件のタイトルと「すべての記事」
- `"links to the steps for a first visit"`: 「はじめての方へ」の `href` が `#how-to`

e2e:
- `sidebar.spec.ts`: 「on a wide screen the sidebar is a column…」の対象から `/` を外す。`/` のビルド時の HTML にお知らせの見出しがあるテストはそのまま通ること
- `guides.spec.ts`: `/` のビルド時の HTML に、記事 1 件の `href="/guides/<slug>"` があることを足す

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top/top-page.browser.test.tsx"`
Expected: 新しいテストが FAIL

- [ ] **Step 3: 書く**

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run "apps/web/src/routes/(site)/-top"` と `pnpm test:e2e -- sidebar guides`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "トップを LP の並びにし、使い方と買い物ガイドを足す"
```

### Task 5: ヘッダーの買い物ガイドとヘルプ

**Files:**
- Modify: `apps/web/src/routes/-root/site-header.tsx`
- Modify: `apps/web/e2e/pages/`（ヘッダーのページオブジェクト）、`apps/web/e2e/site-layout.spec.ts`

**Interfaces:**
- Produces: ヘッダーの `RouterLink`「買い物ガイド」（`to="/guides"`）と「ヘルプ」（`to="/help"`）

- PC（`lg` より広い）: ロゴの右に「買い物ガイド」「ヘルプ」。右端は今どおりカラーモードと共通設定
- スマホ（`lg` 以下）: ロゴ、「ガイド」（`to="/guides"`、`aria-label` は付けず文字のまま）、カラーモード、メニュー。メニューの中に「ヘルプ」を共通設定の下に足す
- 表示中のページには今のリンクと同じく `aria-current="page"` が付く（`_current={{ fontWeight: "bold" }}`）

- [ ] **Step 1: 失敗する e2e を書く**

`site-layout.spec.ts`:
- `"the header links to the guides and the help"`: 1280px で `/` を開き、ヘッダーの「買い物ガイド」で `/guides`、「ヘルプ」で `/help` の見出しが見える。`/guides` ではその リンクに `aria-current="page"`
- 既存の「on a phone the header has …」に、「ガイド」が見えることと、メニューの「ヘルプ」で `/help` へ進むことを足す

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm test:e2e -- site-layout`
Expected: 新しいテストが FAIL

- [ ] **Step 3: `site-header.tsx` を直す**

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm test:e2e -- site-layout`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "ヘッダーに買い物ガイドとヘルプへのリンクを置く"
```

### Task 6: 仕上げの確認と PR

- [ ] **Step 1: すべてのチェック**

Run: `pnpm check:all` と `pnpm test:e2e`
Expected: PASS（ポート 4173 を別の worktree が使っていたら、空くのを待つ）

- [ ] **Step 2: 本番ビルドの HTML を確かめる**

Run: `pnpm build` のあと、`/` の HTML に h1「楽天お買い物マラソンのポイント計算ツール」、説明文、記事へのリンクがあること

- [ ] **Step 3: 画面を見る**

PC（1280px）とスマホ（390px）で、開催中 1 件・開催中 2 件・イベントなし、プランあり・なしを見て、Artifact の A と並びが同じことを確かめる

- [ ] **Step 4: PR を出す（マージしない）**

本文は `.github/pull_request_template.md` の節で書き、`Closes #265`。レビュー観点に `[トップ](/)`、`[買い物ガイド](/guides)`、`[ヘルプ](/help)` を添える。Yamada UI にない部品を作っていれば、探した部品と使わなかった理由を書く。
