# 「このサイトについて」とフッター・ヘルプの組み直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 運営者が誰かを `/about` と全ページのフッターで示し、ヘルプ・規約・ガイドの表記をそろえる。

**Architecture:** `/about` はプリレンダーするページで、loader のサーバー関数が `https://links.bmth.dev/profile.json` を読み、valibot で検証してプロフィールと作品を描く。運営者の名前は `page-head.ts` の定数 1 つから、フッター・構造化データ・ガイドの著者表記が参照する。フッターはリンクを見出しつきの 4 群に分ける。

**Tech Stack:** TanStack Start / Router、Yamada UI v2（`@workspaces/ui`）、valibot、vitest、Playwright

**Spec:** https://github.com/bmthd/point-sprint/issues/300 と設計案 https://claude.ai/artifact/9Wx71zwtWimnq8MaCqhJPj

## Global Constraints

- 運営者の名前は「じょうげん」。`apps/web/src/page-head.ts` に `export const operatorName = "じょうげん";` を置き、TS からはこれだけを使う（Markdown の本文は直書き）
- フッターの署名は次の 2 行だけ: `ポイントスプリントは個人開発のサイトです。` / `© 2026 じょうげん`
- リポジトリ: `https://github.com/bmthd/point-sprint`（MIT）。Issue: `https://github.com/bmthd/point-sprint/issues`
- プロフィールの出どころ: `https://links.bmth.dev/profile.json`（`version: 1`）。point-sprint にプロフィールや作品のコピーを持たない
- 作った理由は仮の文。コードに `{/* 仮の文。じょうげんの文に差し替える (#300) */}` を添える
- `/help` のパスは変えない。題と呼び名を「使い方」にそろえる
- AGENTS.md の配置・命名・import の規則に従う（1 ルートだけが使うものはルートの隣に `-` で始まる名前で置く、`#/` と拡張子つきの import、export する関数は `function` 宣言）

## Review Focus

- links.bmth.dev が落ちている・形が変わった: `profile.json` の検証に失敗したら loader は投げ、ビルドが止まる。壊れたプロフィールを黙って出さない（Task 1 のテスト `rejects a profile of another version`）
- 作品の一覧に point-sprint 自身が出る: URL のオリジンが `siteUrl` と同じものを除く（Task 1 のテスト `leaves out this site`）
- フッターの GitHub へのリンク: 外部リンクなので e2e の「フッターのリンクがすべて開ける」で `follow` できない。`linkTargets` は `/` で始まるものだけを返す（Task 3）
- 名前の変更漏れ: 「使い方・注意事項」「ヘルプ」が残ると、ヘッダー・フッター・ページの題で呼び名がずれる（Task 4 の最後の grep）
- アフィリエイトの断り書きが、リンクのない記事にまで出る: 商品リストも `:rakuten[` もない記事には出さない（Task 6 のテスト）

---

### Task 1: profile.json を読むサーバー関数

**Files:**
- Create: `apps/web/src/routes/(site)/(markdown)/-about/profile.ts`
- Create: `apps/web/src/routes/(site)/(markdown)/-about/profile.test.ts`
- Create: `apps/web/src/routes/(site)/(markdown)/-about/profile.functions.ts`

**Interfaces:**
- Produces:
  - `const Profile`（valibot スキーマ）と `type Profile = v.InferOutput<typeof Profile>`。読むのは `version`（`v.literal(1)`）、`name.ja`、`bio.ja`、`url`、`avatar[]`（`url`, `width`, `height`, `type`）、`sameAs: string[]`、`sections[]`（`id: string`, `items[]`: `label.ja`, `url`, `me: boolean`）。ほかのフィールドは捨てる
  - `function parseProfile(json: unknown): Profile`（失敗で投げる）
  - `function profileLinks(profile: Profile): { label: string; url: string }[]` — `id: "sns"` の項目に、末尾へ `{ label: "links.bmth.dev", url: profile.url }` を足す
  - `function otherWorks(profile: Profile): { label: string; url: string }[]` — `id: "works"` の項目から、`new URL(url).origin === new URL(siteUrl).origin` のものを除く
  - `export const getProfile = createServerFn({ method: "GET" })` — handler で `fetch("https://links.bmth.dev/profile.json")`、`!response.ok` なら投げ、`parseProfile(await response.json())` を返す

- [ ] **Step 1: テストを書く**（`profile.test.ts`。いま配信中の JSON を縮めたものを fixture にする）

```ts
test("reads the name, bio and links of the profile", () => {
  const profile = parseProfile(fixture);
  expect(profile.name.ja).toBe("じょうげん");
  expect(profileLinks(profile).map((l) => l.label)).toEqual(["X", "GitHub", "Zenn", "Blog", "links.bmth.dev"]);
});
test("leaves out this site from the works", () => {
  expect(otherWorks(parseProfile(fixture)).map((w) => w.url)).not.toContain("https://point-sprint.bmth.dev/");
});
test("rejects a profile of another version", () => {
  expect(() => parseProfile({ ...fixture, version: 2 })).toThrow();
});
```

- [ ] **Step 2: 落ちることを確かめる** — `pnpm vitest run "src/routes/(site)/(markdown)/-about/profile.test.ts"` → FAIL（モジュールがない）
- [ ] **Step 3: `profile.ts` と `profile.functions.ts` を書く**（handler 内の import は docs/server-imports.md に従う）
- [ ] **Step 4: 通ることを確かめる** — 同じコマンドで PASS
- [ ] **Step 5: Commit** — `運営者のプロフィールを links.bmth.dev の profile.json から読む`

### Task 2: `/about` のページ

**Files:**
- Create: `apps/web/src/routes/(site)/(markdown)/about.tsx`
- Create: `apps/web/src/routes/(site)/(markdown)/-about/about-page.tsx`
- Modify: `apps/web/src/page-head.ts`（`operatorName` を足す）
- Modify: `apps/web/src/prerender-pages.ts`（`"/about"` を `"/help"` の前に）
- Modify: `apps/web/e2e/page-head.spec.ts`、`apps/web/e2e/site-layout.spec.ts` の `pages`（`{ name: "このサイトについて", path: "/about" }`）

**Interfaces:**
- Consumes: Task 1 の `getProfile`, `profileLinks`, `otherWorks`, `Profile`
- Produces: `operatorName`（`page-head.ts`）。ルート `/about`

- [ ] **Step 1: e2e を書く** — `page-head.spec.ts` に `{ path: "/about", title: "このサイトについて | ポイントスプリント" }`。`site-layout.spec.ts` の `pages` に `/about` を足す
- [ ] **Step 2: ルートを書く** — loader は `getProfile()`。head は `pageHead({ path: "/about", title: "このサイトについて", description: "ポイントスプリントを作っている人、ソースコード、運営費の出どころ、楽天との関係、データの扱いを説明します。" })` と `AboutPage` の JSON-LD（`mainEntity` に `Person`: `name`, `url: profile.url`, `image: profile.avatar[0].url`, `sameAs`）。component は `AboutRoute`（ファイルの下に置き `<AboutPage profile={Route.useLoaderData()} />`）
- [ ] **Step 3: `AboutPage` を Yamada UI の部品で組む**（`Avatar`、`Heading`、`Text`、`Link`、`Wrap` など。カードの見た目は `-markdown-body.tsx` の `insetCardProps` に合わせる）。文言はこのとおり:
  - h1「このサイトについて」
  - リード「ポイントスプリントは、じょうげんが個人で作っている、楽天市場のポイント計算ツールです。楽天グループとは関係ありません。ソースコードはすべて公開しています。」
  - h2「作っている人」: アバター（`avatar[0]`、64px）、名前、肩書き、`profileLinks` のリンク（外部、新しいタブ）
  - 仮の作った理由「お買い物マラソンのたびに、買いまわりのショップ数と上限までの残りを電卓とメモで数えていました。毎回の計算が面倒で、金額を入れるだけで分かるツールを作りました。」
  - h2「ほかに作ったもの」: `otherWorks` のリンク
  - h2「ソースコード」「計算のしかたと、サーバーに何を送っているかは、誰でもコードで確かめられます。ライセンスは MIT です。」＋ `bmthd/point-sprint` へのリンク
  - h2「費用と収益」「無料で使えます。Google AdSense の広告と、買い物ガイドの楽天アフィリエイトのリンクで運営費をまかなっています。」
  - h2「楽天との関係」「楽天グループ株式会社とは関係のない、個人のサイトです。商品の情報は楽天ウェブサービスの API から取得しています。」
  - h2「データの扱い」「入力した内容は、お使いのブラウザの中に保存されます。ほかの端末と同期するときも、端末の中で暗号にしてから送るので、運営者も中身を読めません。詳しくはプライバシーポリシーをご覧ください。」（`/privacy` へ）
  - h2「ご意見・不具合の報告」「お問い合わせからどうぞ。GitHub をお使いなら Issue でも受け付けます。」（`/inquiry` と Issue へ）
- [ ] **Step 4: 確かめる** — `pnpm type:check && pnpm --filter web build`（`dist/client/about/index.html` ができ、プリレンダーの head 検査が通る）。`pnpm build:e2e && pnpm --filter web exec playwright test e2e/page-head.spec.ts` が PASS。dev で `/about` を PC 1470 幅と iPhone 幅で見る
- [ ] **Step 5: Commit** — `運営者が誰かを示す「このサイトについて」を足す`

### Task 3: フッター

**Files:**
- Modify: `apps/web/src/routes/-root/site-footer.tsx`
- Modify: `apps/web/e2e/pages/site-page.ts`（`linkTargets` を `/` で始まる href に絞る）
- Modify: `apps/web/e2e/site-layout.spec.ts`（「the footer links to each page…」の一覧）

**Interfaces:**
- Consumes: `operatorName`
- Produces: `footerLinks` を `footerGroups: readonly { heading: string; links: readonly ({ to: LinkProps["to"]; label: string } | { href: string; label: string })[] }[]` に置き換える

- [ ] **Step 1: e2e を直す** — 一覧に `{ label: "運営者", path: "/about", heading: "このサイトについて" }` を足し、`使い方・注意事項` を `{ label: "使い方", path: "/help", heading: "使い方" }` に。フッターに `ポイントスプリントは個人開発のサイトです。` と `© 2026 じょうげん` があることを確かめる行を足す
- [ ] **Step 2: フッターを書き換える** — 群と順は「使う: マラソンの日程と上限(/marathon)・SPU(/spu)」「読む: 買い物ガイド(/guides)・お知らせ(/notices)・使い方(/help)」「このサイトについて: 運営者(/about)・ソースコード(GitHub, 新しいタブ)・お問い合わせ(/inquiry)」「決まりごと: 利用規約(/terms)・プライバシーポリシー(/privacy)」。PC は 4 列、`md` 未満は 2 列×2 段。今ある保存先の一文と楽天のクレジットは残し、署名 2 行はその間に置く。`nav aria-label="サイトの案内"` は残す
- [ ] **Step 3: 確かめる** — `pnpm build:e2e && pnpm --filter web exec playwright test e2e/site-layout.spec.ts` が PASS。PC と iPhone 幅で見る
- [ ] **Step 4: Commit** — `フッターのリンクを 4 つに分け、個人開発の署名を入れる`

### Task 4: ヘッダーとヘルプの呼び名を「使い方」にそろえる

**Files:**
- Modify: `apps/web/src/routes/-root/site-header.tsx`（「ヘルプ」→「使い方」。メニューの「使い方」の次に `/about`「このサイトについて」）
- Modify: `apps/web/src/routes/(site)/(markdown)/help.tsx`（title「使い方」、description から「注意事項」を外す）
- Modify: `apps/web/src/routes/(site)/(markdown)/-markdown/help.md`（h1「使い方」。「ブラウザを閉じてもデータが保持」の節は第 1 段落と「ほかの端末でも…『ほかの端末と同期』を使います。」だけ残し、送る情報の段落を「送る情報はプライバシーポリシーにまとめています。」に。「サイト利用上の注意事項」の見出しを「計算の誤差」に）
- Modify: `apps/web/src/routes/routes.test.ts:47`、`apps/web/src/routes/(site)/(markdown)/-markdown-body.test.ts:11`、`apps/web/e2e/page-head.spec.ts:17`、`apps/web/e2e/site-layout.spec.ts`、`apps/web/e2e/pages/site-page.ts`（`helpLink` の name とコメント）
- Modify: `apps/web/src/guides/articles/how-much-to-buy.md:135`（リンクの文字を「使い方」に）

`src/routes/-notices/notices.ts` の過去のお知らせは書いた時点の文なので変えない。

- [ ] **Step 1: テストの期待値を「使い方 | ポイントスプリント」「使い方」に直す**
- [ ] **Step 2: 落ちることを確かめる** — `pnpm vitest run src/routes/routes.test.ts` → FAIL
- [ ] **Step 3: ヘッダー・ヘルプ・記事を直す**
- [ ] **Step 4: 確かめる** — vitest が PASS、`pnpm build:e2e && pnpm --filter web exec playwright test e2e/site-layout.spec.ts e2e/page-head.spec.ts` が PASS、`rg -n "使い方・注意事項|\"ヘルプ\"|>ヘルプ<" apps/web/src apps/web/e2e` が notices.ts だけを返す
- [ ] **Step 5: Commit** — `ヘルプの呼び名を「使い方」にそろえ、データの保存の説明をプライバシーポリシーに寄せる`

### Task 5: プライバシーポリシーと利用規約で運営者を名乗る

**Files:**
- Modify: `apps/web/src/routes/(site)/(markdown)/-markdown/privacy.md`
- Modify: `apps/web/src/routes/(site)/(markdown)/-markdown/terms.md`

- [ ] **Step 1: privacy.md** — 冒頭の段落を「ウェブサイト「ポイントスプリント」（以下、「当サイト」といいます）の運営者（[じょうげん](/about)）は、…」にする
- [ ] **Step 2: terms.md** — 「サービスの提供」の節の頭に「当サイトは、[じょうげん](/about)が個人で運営しています。楽天グループ株式会社とは関係がありません。」を足す
- [ ] **Step 3: 確かめる** — `pnpm vitest run "src/routes/(site)/(markdown)/-markdown-body.test.ts"` が PASS（Markdown の見出し・リンクの検査）
- [ ] **Step 4: Commit** — `プライバシーポリシーと利用規約で運営者を名乗る`

### Task 6: ガイドの著者表記と構造化データ

**Files:**
- Modify: `apps/web/src/guides/markdown.ts`（`hasAffiliateLinks` を足す）
- Modify: `apps/web/src/guides/markdown.test.ts`
- Modify: `apps/web/src/routes/(site)/(markdown)/guides/-article-dates.tsx`
- Modify: `apps/web/src/routes/(site)/(markdown)/guides/-guide-article.tsx`
- Modify: `apps/web/src/routes/(site)/(markdown)/guides/$slug.tsx`（`Article` の JSON-LD）
- Modify: `apps/web/src/routes/(site)/index.tsx`（`WebSite` に `publisher`）

**Interfaces:**
- Consumes: `operatorName`
- Produces: `function hasAffiliateLinks(body: string): boolean` — 本文に `:::items{` で始まる行か `:rakuten[` があれば true

- [ ] **Step 1: テストを書く**

```ts
test("an article with a list of items or a Rakuten link has affiliate links", () => {
  expect(hasAffiliateLinks('前置き\n\n:::items{keyword="コーヒー" hits=6}\n')).toBe(true);
  expect(hasAffiliateLinks("[楽天ブックス]なら :rakuten[楽天ブックス](https://books.rakuten.co.jp/)")).toBe(true);
  expect(hasAffiliateLinks("ふつうの [リンク](https://example.com/)")).toBe(false);
});
```

- [ ] **Step 2: 落ちることを確かめる** — `pnpm vitest run src/guides/markdown.test.ts` → FAIL
- [ ] **Step 3: 実装する**
  - `hasAffiliateLinks` を書く
  - `ArticleDates` の日付の後ろに「・書いた人 [じょうげん](/about)」（`RouterLink`、名前は `operatorName`）
  - `GuideArticle` の header の下に、`hasAffiliateLinks(article.body)` のときだけ `Text fontSize="sm" color="fg.muted"`「この記事には、楽天市場のアフィリエイトのリンクを含みます。」
  - `$slug.tsx` の head に `scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline, datePublished, dateModified: updated ?? published, author: { "@type": "Person", name: operatorName, url: `${siteUrl}/about` } }) }]`
  - トップの `WebSite` に `publisher: { "@type": "Person", name: operatorName, url: `${siteUrl}/about` }`
- [ ] **Step 4: 確かめる** — vitest が PASS、`pnpm build:e2e && pnpm --filter web exec playwright test e2e/guides.spec.ts` が PASS、ビルドしたガイドの HTML に `"@type":"Article"` があること
- [ ] **Step 5: Commit** — `ガイドに書いた人を示し、構造化データに運営者を入れる`

### 仕上げ

- [ ] `pnpm check:all` が通る
- [ ] PR の本文はテンプレートの節で書き、レビュー観点に `[このサイトについて](/about)`、`[使い方](/help)`、`[ガイドの記事](/guides/how-much-to-buy)`、`[利用規約](/terms)`、`[プライバシーポリシー](/privacy)` を添える。Yamada UI で探した部品（`Avatar` など）を書く
- [ ] PR は見た目とコードを確かめてもらってから出す
