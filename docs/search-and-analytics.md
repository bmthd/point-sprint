# アクセス解析と検索エンジン

サイト（https://point-sprint.bmth.dev ）のアクセスは Google Analytics 4 で数える。検索での見え方は Google Search Console と Bing Webmaster Tools で見る。配信は Cloudflare の Worker が担う。この文書は、それぞれの置き場所、つなぎ方、数字を読むときの注意をまとめる。

## Google Analytics 4

プロパティは「楽天ツール」、測定 ID は `G-B6CYR6VF70`。

### タグの入れ方

- 測定 ID と AdSense のクライアント ID は、ルートの `.env.production` の `PUBLIC_GA_MEASUREMENT_ID` と `PUBLIC_ADSENSE_CLIENT_ID` に置く。本番のビルドだけが読み、`apps/web/src/google-tags/` が `<head>` に gtag.js を入れる。開発とテストのビルドには入らない
- AdSense は、`.env.production` の `PUBLIC_ADSENSE_PAUSED="true"` で、アクセスが増えるまで止めている。この値が `true` の間は、本番のビルドも AdSense のスクリプトと広告枠を入れない。`ads.txt` とクライアント ID は残してあるので、この行を消せば広告が再開する。ビルドの環境変数で `PUBLIC_ADSENSE_PAUSED` を渡せば、ファイルより優先される
- Pull Request の Preview（`preview.yml`）は `PULL_REQUEST_PREVIEW=true` でビルドし、gtag.js を入れない。Preview のアクセスは本番の数字に混ざらない
- 最初の表示の page_view は `gtag('config')` が送る。それ以降の画面の切り替えは、GA4 の拡張計測の「ブラウザの履歴イベントに基づくページの変更」が数える。アプリは自分で page_view を送らないので、この設定は GA4 のストリームの設定で必ずオンのままにする

### 数字の取り方

- 管理画面のほか、Data API で取れる。Claude Code では `analytics-mcp` の `run_report` を使う
- 認証にはサービスアカウントを使い、GA のプロパティには「閲覧者」で追加してある。プロパティ ID と鍵は運営者の手元にだけ置き、リポジトリには入れない。請求先アカウントは紐づけず、無料の上限内で使う

### 数字を読むときの注意

- **国を日本に絞ってから見る。** 2026-10 には、利用者の 6 割が米国などのデータセンターのボットだった（画面 800x600、Council Bluffs・Boardman）。全体の数字は 10〜40 倍に膨らんでいた。Bing からの訪問も、ほとんどがボットだった。サイト側でボットを GA から外すことはせず、見るときに絞る
- **急に増えた日は、同じ端末に偏っていないかを先に見る。** 2026-11-04 の 14〜16 時に新規が 61 人あったが、全員が「大田区・393x852・iOS 17.5」だった。説明動画を撮るスクリプトが、Playwright の `devices["iPhone 15"]` で本番を開いた分だった。本番に向けてブラウザを自動で動かすと、GA の数字が増える
- `pagePath` は末尾の `/` の有無で別の行になる（`/plan` と `/plan/`）。ページごとに見るときは合わせて数える
- 運営者が自分で検索して開いた分も数字に入る。「Organic Search」のセッションが多くても利用者が 1〜2 人なら、運営者のアクセスを疑う

## Google Search Console

- プロパティはドメイン プロパティの `sc-domain:point-sprint.bmth.dev`（https://search.google.com/search-console?resource_id=sc-domain%3Apoint-sprint.bmth.dev ）。`sc-domain:bmth.dev` を開くと「ようこそ」の画面になり、未登録に見えるが、登録されていないわけではない
- サイトマップは `https://point-sprint.bmth.dev/sitemap.xml` を送ってある。2026-10-25 に送り直し、トップ、`/guides`、`/guides/1000yen-items`、`/guides/how-much-to-buy` のインデックス登録をリクエストした
- URL 検査は、画面上部の検索欄に URL を入れて Enter を押す。`/search-console/inspect?id=...` を直接開くと 404 になる

### API

- GA と同じサービスアカウントを「制限付き」のユーザーで追加し、その Google Cloud プロジェクトで Search Console API を有効にしてある
- `google-auth` の `AuthorizedSession`（スコープ `https://www.googleapis.com/auth/webmasters.readonly`）で、`https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Apoint-sprint.bmth.dev/searchAnalytics/query` に POST する
- Python から呼ぶと、Google への接続が IPv6 で止まることがある。`urllib3.util.connection.allowed_gai_family = lambda: socket.AF_INET` で IPv4 に固定する

## Bing Webmaster Tools

- 2026-11-07 に登録した（https://www.bing.com/webmasters/home?siteUrl=https://point-sprint.bmth.dev/ ）。運営者の Google アカウントでサインインし、Search Console から取り込んだ。所有権の確認は Search Console で済んでいるため、確認用の `BingSiteAuth.xml` やメタタグはサイトに置いていない
- 取り込みのとき、Bing に Search Console の閲覧の権限（`webmasters.readonly`）を許可した。Bing はこの権限で、確認の状態とサイトマップを定期的に読む
- 同じ日に `sitemap.xml` を送り、サイトマップにある 12 URL を「URL Submission」から送った（1 日 10,000 件まで送れる）
- 「AI Performance」（ベータ）の画面で、Copilot などの AI に引用された回数を見られる

### なぜ Bing に登録するか

ChatGPT はウェブを検索するとき、Bing の索引と OpenAI のクローラー（OAI-SearchBot）を使う。Bing の索引に入らなければ、Google で上位に出ていても ChatGPT の検索には出にくい。

## Cloudflare

| 項目 | 値 |
|---|---|
| ゾーン | `bmth.dev`（Free プラン） |
| Worker | `point-sprint` |

- Worker の設定は `apps/web/cloudflare.config.ts` にある。本番のデプロイでは、カスタムドメイン `point-sprint.bmth.dev` を Worker に向ける。`workers.dev` を切っているので、リクエストはすべてゾーンの WAF を通る。Preview の `workers.dev` の URL（`previewUrls`）だけは残している
- **Crawler Hints** はゾーン `bmth.dev` で有効になっている（ダッシュボードの「Caching → 構成」、2026-11-07 に確認）。ページの中身が変わったとき、Cloudflare が IndexNow で Bing などに知らせる。ただし、Worker が毎回描くページ（`/`、`/marathon`）の更新も知らせているかは、まだ確かめていない

## クローラーに渡すもの

- `robots.txt` はクライアントのビルドが書く（`apps/web/src/prerender-pages.ts` の `robotsTxt`）。すべてのクローラーに全体を許可し、サイトマップの場所を書く。GPTBot、OAI-SearchBot、ChatGPT-User、Bingbot も、すべて 200 で本文を受け取れる（2026-11-07 に確認）
- `sitemap.xml` は `pnpm build` の後に作る。プリレンダーしたページと、`indexedPagesRenderedOnRequest`（`/`、`/marathon`）を載せ、`noindex` のページは除く。`cf previews deploy` はビルドをやり直すので、Preview では `/sitemap.xml` が 404 になる
- `llms.txt` は置いていない。ChatGPT がこのファイルを読むという根拠がまだないため
