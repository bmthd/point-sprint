# 外部連携の検証結果（計画1 タスク1）

検証日: 2026-10-04。検証用のコードはリポジトリに入れていない。キーやトークンの値はここに書かない（公開してよい値は `.env.development` と `.env.production` に平文で、秘密の値は `.env.production` に dotenvx で暗号化して置いてある）。

## 結論

設計書6節の外部連携は、すべて設計どおりに使える。ただし、楽天 API の呼び出し元の判定に `Referer` ではなく `Origin` ヘッダーが使われるので、開発中の呼び出し方を変える必要がある。

## 楽天 商品検索 API

- **エンドポイント:** `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701`。必須パラメータは `applicationId` と `accessKey`。`affiliateId` を付けると `itemUrl` と `affiliateUrl` がアフィリエイトリンクになる。
- **呼び出し元の判定:** `Origin` ヘッダーの値が、アプリ設定の「許可された Web サイト」（本番の `https://point-sprint.bmth.dev`）と一致するときだけ通す。`Origin` がないと 403 `REQUEST_CONTEXT_BODY_HTTP_REFERRER_MISSING`、許可していないドメインだと 403 `HTTP_REFERRER_NOT_ALLOWED` になる。`Referer` ヘッダーだけを付けても通らない。
- **許可できるドメイン:** `*` や `localhost` はアプリ設定で登録できない（ユーザーが確認）。
- **CORS:** レスポンスに `Access-Control-Allow-Origin: *` が付く。本番のドメインのページからは、ブラウザの `fetch` でそのまま呼べる。
- **サーバー側（ビルド時）:** Node の `fetch` に `Origin: https://point-sprint.bmth.dev` を付けると 200 で返る。ビルド時の広告取得はこの方法で行う。
- **開発中:** ブラウザは `localhost` を `Origin` として送るので、直接は呼べない。開発サーバーで API への呼び出しを中継し、中継側で `Origin` を付け替える必要がある（計画3で扱う）。
- **アクセスキーの扱い:** `Origin` はサーバー側から自由に付けられるので、`accessKey` が漏れると第三者も使える。クライアントに置く前提のキーとして扱い、秘密情報としては扱わない。
- **商品の URL からの取得:** 商品の URL（`item.rakuten.co.jp/<ショップコード>/<商品管理番号>/`）の商品管理番号は、API の `itemCode`（`<ショップコード>:<楽天の内部の番号>`、例: `mapcamera:12238315`）とは別の値である。そのため `itemCode=<ショップコード>:<商品管理番号>` では、ふつうは 400 `itemCode is not valid` になる。番号がたまたま一致する商品だけが取れるので、別の商品を取ってしまうおそれもある（2026-10-07 に確認。当初は `itemCode` で取れると書いていたが、誤りだった）。
  - かわりに `shopCode=<ショップコード>&keyword=<商品管理番号>` で検索し、結果のうち商品ページの URL が一致するものを使う。14件で試したところ11件が見つかった。商品管理番号が検索の対象になっていない商品は見つからない。
  - 存在しないショップコードや、短すぎるキーワード（1文字）には 400 が返る。
  - レスポンスの `Items[].Item` には `itemName`、`itemPrice`、`itemCode`、`itemUrl`、`shopCode`、`shopName`、`pointRate`、`taxFlag`、`affiliateUrl`、画像の URL などが含まれる。`affiliateId` を付けると `itemUrl` もアフィリエイトリンク（`hb.afl.rakuten.co.jp`）になり、元の商品ページの URL は `pc` パラメータに入る。
- **レート制限:** 1秒に1回程度を超えると 429 `Rate limit is exceeded` になる。

## メール送信（Cloudflare `send_email`）

- **ドメインの設定:** `bmth.dev` の Email Routing を有効にした（状態 `ready`）。Cloudflare の MX、SPF（`v=spf1 include:_spf.mx.cloudflare.net ~all`）、DKIM（`cf2024-1`）が入っている。既存の `v=spf1 -all` はユーザーの了承を得て置き換えた。DMARC（`p=reject`、整合性は strict）は既存のまま。
- **宛先:** 運営者の個人アドレスを Email Routing の宛先として登録済み（確認済みの状態）。
- **送信:** `cf` CLI で作った検証用の Worker に `bindings.sendEmail({ destinationAddress })` を設定し、`cloudflare:email` の `EmailMessage` で `inquiry@bmth.dev` から送信して成功した（`send()` が例外なしで完了）。生の MIME を組み立てて渡す。件名に日本語を使うときは MIME の B エンコードにする。
- **Cloudflare CLI:** `cf`（npm の `cf`、1.0.0-beta.12）で `cf init`、`cf deploy` ができる。設定ファイルは `cloudflare.config.ts`（`cf/config` の `defineConfig` と `bindings`）。pnpm 12 では `workerd` と `esbuild` のビルドスクリプトを `allowBuilds` で許可する必要がある。

## Turnstile

- テスト用のキー（常に成功するシークレット `1x0000000000000000000000000000000AA`）で `siteverify` が `success: true` を返すことを確かめた。常に失敗するシークレットでは `invalid-input-response` になる。
- 本番用のウィジェット（名前 `point-sprint inquiry`、ドメイン `point-sprint.bmth.dev`、モード `managed`）を作り、サイトキーとシークレットを `.env.production` の `PUBLIC_TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY` に入れた。開発中は Cloudflare のテスト用キーを使う（`.env.development`）。新しいサイトの Worker（`point-sprint.jougennotuki67.workers.dev`）とプレビュー（`pr-<番号>-point-sprint.jougennotuki67.workers.dev`）でも動くよう、あとからドメインに `jougennotuki67.workers.dev` を足した。Turnstile のドメインには `*` を書けないが、足したドメインのサブドメインはすべて許可される。

## 計画への影響

- 設計書6節の「Referer の制限」は「Origin の制限」と読み替える。開発中の楽天 API の呼び出しには中継が要る。
- 配信は `cf` CLI と `cloudflare.config.ts` を使う。TanStack Start を `cf` でビルド・デプロイできることは、`.github/workflows/deploy.yml` で確かめた。
