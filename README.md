# ポイントスプリント

楽天のお買い物マラソンなどのイベントで、「あといくら買えるか、あと何店舗回るか」を計算するツールです。

本番: https://point-sprint.bmth.dev

## セットアップ

```sh
mise install
pnpm install
pnpm --filter web exec playwright install chromium
```

楽天 API のキーは `.env.development` に暗号化してあります。復号できなくても動きますが、商品の検索とガイド記事の商品一覧は出ません。

## コマンド

| コマンド                | すること                                      |
| ----------------------- | --------------------------------------------- |
| `pnpm dev`              | 開発サーバーを立てる                          |
| `pnpm check:all`        | lint・整形・型・スペル・テスト。PR の前に通す |
| `pnpm test:e2e`         | E2E テスト                                    |
| `mise x -- jactionlint` | `.github` のワークフローの検査                |

E2E はポート 4173 と 4174 を固定で使います。worktree を並べて走らせるときは、空くのを待ちます。

## 開発の決まり

[AGENTS.md](AGENTS.md) と `docs/` にあります。
