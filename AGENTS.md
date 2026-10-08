# AGENTS.md

## ファイルの置き場所（`apps/web/src`）

置き場所は、そのファイルを使う場所で決める。

- **1 つのルートだけが使うもの**は、そのルートの隣に `-` で始まる名前で置く。TanStack Router は `-` で始まるファイルとディレクトリをルートとして扱わない。例: `routes/(markdown)/-markdown-body.tsx`
- **2 つ以上のルートが使うもの**は、使うルートすべての一番近い共通の親に置く。共通の親がなければ、ルートグループ（`routes/(plan)/` など）を作ってまとめる。ルートグループは URL を変えない
- **アプリ全体で使う、業務の意味を持たない UI の部品と整形**は `src/ui/` に置く。ルーターへのリンク、アイコン、日付の整形がこれにあたる
- **React に依存しない計算とモデル**は `packages/domain`（`@workspaces/domain`）に置く

置き場所を合わせるためだけにファイルを分けない。`src/` の直下に、中身ごとのディレクトリを足さない。2 つ目のルートが使うときに、共通の親へ移す。

## UI の部品

画面の部品は Yamada UI v2 の部品で組む。`@workspaces/ui` は Yamada UI のすべての部品を export している。

- 部品を作る前に、`packages/ui/src/index.ts` の export から使えるものを探す。使い方は ctx7 の `/yamada-ui/yamada-ui` で調べる
- `Box` に `as` を付けて要素を組み立てるのは、役割に合う部品がないときだけにする
- 見た目は部品の `variant`、`size`、`colorScheme` で選び、色はテーマのトークンで指定する（`docs/design-system.md`）
- Yamada UI にない部品を作ったときは、探した部品の名前と、使わなかった理由を PR に書く
