# AGENTS.md

## ファイルの置き場所（`apps/web/src`）

置き場所は、そのファイルが特定の画面を知っているかで決める。今いくつのルートが使っているかでは決めない。

- **画面を知っているもの**は、そのルートの隣に `-` で始まる名前で置く。その画面の文言、レイアウト、画面の状態を扱うものがこれにあたる。TanStack Router は `-` で始まるファイルとディレクトリをルートとして扱わない。例: `routes/(markdown)/-markdown-body.tsx`
- **画面を知らないもの**は、今使う画面が 1 つでも、`src/` の直下に中身を表す名前のディレクトリで置く（`layout/`、`share/` など）。ルーターへのリンク、アイコン、日付の整形のように、どの画面からでも同じ意味で使えるものがこれにあたる
- **React に依存しない計算とモデル**は `packages/domain`（`@workspaces/domain`）に置く

迷ったらルートの隣に置き、2 つ目の画面が使うときに `src/` の直下へ移す。

`features/` は #73 で再配置するまでの古い形である。新しいファイルは上の規則で置き、`features/` には足さない。

## UI の部品

画面の部品は Yamada UI v2 の部品で組む。`@workspaces/ui` は Yamada UI のすべての部品を export している。

- 部品を作る前に、`packages/ui/src/index.ts` の export から使えるものを探す。使い方は ctx7 の `/yamada-ui/yamada-ui` で調べる
- `Box` に `as` を付けて要素を組み立てるのは、役割に合う部品がないときだけにする
- 見た目は部品の `variant`、`size`、`colorScheme` で選び、色はテーマのトークンで指定する（`docs/design-system.md`）
- Yamada UI にない部品を作ったときは、探した部品の名前と、使わなかった理由を PR に書く

## PR の Preview

画面に関わる変更の PR では、本文を `.github/pull_request_template.md` の形で書き、`## Preview` の節に変更・追加したページを `- [ページ名](/path)` の形で並べる。Preview のジョブが、この節のパスを Preview の URL（`https://pr-<PR番号>-point-sprint.jougennotuki67.workers.dev`）に書き換える。

- Preview のジョブが終わったら、各リンクが 200 を返すことを確かめる
- Preview と本番で違うページは、リンクにその違いを添える。`cf previews deploy` はビルドをやり直すので、`pnpm build` の後に生成するファイル（`/sitemap.xml` など）は Preview では 404 になる
