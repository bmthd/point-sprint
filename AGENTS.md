# AGENTS.md

## ファイルの置き場所（`apps/web/src`）

置き場所は、そのファイルを使う場所で決める。

- **1 つのルートだけが使うもの**は、そのルートの隣に `-` で始まる名前で置く。TanStack Router は `-` で始まるファイルとディレクトリをルートとして扱わない。例: `routes/(markdown)/-markdown-body.tsx`
- **2 つ以上のルートが使うもの**は、使うルートすべての一番近い共通の親に置く。共通の親がなければ、ルートグループ（`routes/(plan)/` など）を作ってまとめる。ルートグループは URL を変えない
- **アプリ全体で使う、業務の意味を持たない UI の部品と整形**は `src/ui/` に置く。ルーターへのリンク、アイコン、日付の整形がこれにあたる
- **React に依存しない計算とモデル**は `packages/domain`（`@workspaces/domain`）に置く

置き場所を合わせるためだけにファイルを分けない。`src/` の直下に、中身ごとのディレクトリを足さない。2 つ目のルートが使うときに、共通の親へ移す。

既存の次のディレクトリは、上の配置ルールの例外として残す。

- `google-tags/`: `__root.tsx` と `vite.config.ts`、`scripts/check-prerender.ts` が使い、ルートに属さない
- `guides/`: 記事のルートと、ビルド設定が使う `prerender-pages.ts` の両方が参照する
- `rakuten/`: ルートとサーバーに加え、`vite.config.ts` と `scripts/` も使う
- `server/`: Worker の入口 `server.ts` とルートの両方が使い、ルートに属さない
- `state/`: `(plan)` と `(site)` の両方が使い、ルートグループをまたいで状態を共有する
- `storage/`: ルートと `state/` の両方が使い、永続化と同期は特定のルートに属さない
- `ui/`: 複数のルートグループに加え、`vite.config.ts` も使う

## サーバーのファイル名

`server/` の処理は、`sync/`、`inquiry/`、`item-lookup/`、`official-events/`、`shared/` に分ける。

サーバー関数は `<名前>.functions.ts`、Worker ランタイムに依存する処理は `<名前>.worker.ts`、ランタイムに依存しない処理は `<名前>.ts` にする。テストは対象の隣に `<名前>.test.ts` で置く。`guides/` も同じ付け方にする。ハンドラー内の動的 import は [docs/server-imports.md](docs/server-imports.md) に従う。

## UI の部品

画面の部品は Yamada UI v2 の部品で組む。`@workspaces/ui` は Yamada UI のすべての部品を export している。

- 部品を作る前に、`packages/ui/src/index.ts` の export から使えるものを探す。使い方は ctx7 の `/yamada-ui/yamada-ui` で調べる
- `Box` に `as` を付けて要素を組み立てるのは、役割に合う部品がないときだけにする
- 見た目は部品の `variant`、`size`、`colorScheme` で選び、色はテーマのトークンで指定する（`docs/design-system.md`）
- Yamada UI にない部品を作ったときは、探した部品の名前と、使わなかった理由を PR に書く

## 外部とのやりとりの差し替え

外部とのやりとりは、本番の処理を初期値に持つ jotai の atom に置き、使う部品で `useAtomValue` から読む。関数はオブジェクトに包む。テストでは専用の store を用意し、`store.set` または `useHydrateAtoms` で atom を差し替える。

## 保存するデータの形

`packages/domain/src/model` の保存する形を変えたら、`CURRENT_SCHEMA_VERSION`（`packages/domain/src/migrations/index.ts`）を 1 上げる。移し替える処理がいらない変更でも上げる。

アプリは、自分の版より新しいデータベースを開くと、読み書きを止めて再読み込みを促す。版を上げると、開いたままの古いタブが新しい形のデータを読めずに退避したり、古い形で上書きしたりするのを防げる。

## PR の本文

本文は `.github/pull_request_template.md` の節で書く。

画面に関わる変更では、レビュー観点に確かめるページを `[ページ名](/path)` の形で添える。Preview のジョブが、この節のパスを Preview の URL（`https://pr-<PR番号>-point-sprint.jougennotuki67.workers.dev`）に書き換える。

- Preview のジョブが終わったら、各リンクが 200 を返すことを確かめる
- Preview と本番で違うページは、リンクにその違いを添える。`cf previews deploy` はビルドをやり直すので、`pnpm build` の後に生成するファイル（`/sitemap.xml` など）は Preview では 404 になる

## コードの書き方

- export する関数は `function` 宣言にする。atom や `createServerFn` など、関数呼び出しの結果は `export const` に置く。
- valibot のスキーマとスキーマを作る関数は `PascalCase` にする。
- ルートの `component` は名前付きの関数を参照する。ルート固有の関数はファイルの下に置き、props を渡さない部品は直接参照する。
- `siteUrl` は `site-url.ts` から直接 import する。
- query key は `apps/web/src/state/queries.ts` の `queryKeys` に集める。
- `packages/domain/src/index.ts` は、公開する名前を列挙して export する。
