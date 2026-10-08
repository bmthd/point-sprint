# AGENTS.md

## ファイルの置き場所（`apps/web/src`）

置き場所は、そのファイルを使うルートの数で決める。

- **1 つのルートだけで使うもの**は、そのルートの隣に `-` で始まる名前で置く。TanStack Router は `-` で始まるファイルとディレクトリをルートとして扱わない。例: `routes/(markdown)/-markdown-body.tsx`
- **2 つ以上のルートで使うもの**は、`src/` の直下に、中身を表す名前のディレクトリで置く（`layout/`、`share/` など）。画面のディレクトリには、その画面だけが使うものを置く
- **React に依存しない計算とモデル**は `packages/domain`（`@workspaces/domain`）に置く

`features/` は #73 で再配置するまでの古い形である。新しいファイルは上の規則で置き、`features/` には足さない。
