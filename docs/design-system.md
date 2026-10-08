# ポイントスプリント デザインシステム

楽天のお買い物マラソンで「あといくら買えるか、あと何店舗回るか」をすぐ判断するための計算ツールの見た目の決まりである。楽天市場の売り場に近い「白地に赤」の明快な面構成にし、買い物の流れから違和感なく行き来できるようにする。SPU とキャンペーンには旧サイトから移植した画像を使う。旧サイトにない新しい SPU は楽天の公式ページから取得したサービスアイコンを使う。

色はすべて Yamada UI v2 のテーマの仕組みに載せる。ブランドの赤の階調を1つ決めてカラースキーム `primary` に割り当てれば、塗り・文字・淡い面などの用途ごとの色は、ライトとダークの両方について Yamada UI の規則で決まる。この文書は「どのパレットを使うか」「既定から変えるトークン」「追加するトークン」「画面の部品にどのトークンを使うか」だけを決める。

テーマの実体は `packages/ui`（`@workspaces/ui`）のテーマ設定に書く。キャンバスのモック（`ポイントスプリント UI`）は、このトークン名を CSS 変数（`bg.panel` → `--bg-panel`）にして使っている。

## 原則

- **数値が主役。** 獲得予定ポイント、還元率、上限までの残額を最初に目に入れる。数値はすべて等幅数字（`font-variant-numeric: tabular-nums`）で桁をそろえる。
- **段階的に開く。** 第1層（サマリー）は常に表示し、注文ごとの内訳は展開で、SPU や上限は設定画面で見せる。
- **赤は意味のある所だけ。** 面いっぱいの赤はサマリーカードだけにする。ほかは主要ボタン、選択中の印、リンク、マラソン（買いまわり）に限る。
- **ライトとダークで同じ情報。** 色は必ずトークンで指定する。16進数を部品に直接書かない。

## パレット

### brand（ブランドの赤）

楽天の赤に近いクリムゾン。500 を基準にし、白い文字を載せても 4.5:1 以上になる濃さにする。

| 階調 | 値 |
| --- | --- |
| 50 | `#fff0f0` |
| 100 | `#ffdcdc` |
| 200 | `#ffb8b8` |
| 300 | `#ff8a8a` |
| 400 | `#f25252` |
| 500 | `#bf0000` |
| 600 | `#a30000` |
| 700 | `#870000` |
| 800 | `#6b0000` |
| 900 | `#520000` |
| 950 | `#330000` |

### そのほか

灰色（`gray`、`black`、`white`）、`amber`、`red`、`green`、`orange`、`blue` は Yamada UI の既定のパレットをそのまま使う。

## カラースキーム

| カラースキーム | パレット | 用途 |
| --- | --- | --- |
| `primary` | `brand` | 主要ボタン、選択中の印、サマリーカード |
| `link` | `brand` | 文中のリンク |
| `secondary` | `gray`（既定） | 補助のボタン |
| `mono` | `black` / `white`（既定） | 選択中のチップ、順番バッジ |
| `danger`・`error` | `red`（既定） | 削除の確認、入力エラー |
| `warning` | `orange`（既定） | 期間外の注文などの警告 |
| `success`・`info` | 既定 | 保存の完了、お知らせ |

`primary` を `brand` にすると、`primary.solid`（ライト 500 / ダーク 600）、`primary.contrast`（白）、`primary.fg`（700 / 100）、`primary.subtle`（50 / 950）、`primary.muted`、`primary.emphasized`、`primary.outline`、`primary.ghost` が自動で決まる。`danger` と `primary` はどちらも赤系だが、削除などの危険な操作は必ず文言と確認の手順を伴わせ、色だけで区別しない。

## 画面全体のトークン

Yamada UI では、トークンの `base` の段は親の名前で参照する。`bg.base` は `bg="bg"`、`point.base` は `bg="point"` と書く（`bg="bg.base"` と書くと解決されない）。

### 既定から変えるもの

| トークン | ライト | ダーク | 理由 |
| --- | --- | --- | --- |
| `bg.base` | `#f5f5f5` | `#121212` | ページの地を薄い灰にして、白いカード（`bg.panel`）を浮かせる |
| `bg.panel` | `#ffffff` | `#1e1e1e` | カード、表、シートの面 |
| `border.emphasized` | `#8f8f8f` | `#6e6e6e` | 入力欄とボタンの枠。`bg.panel` の上で 3:1 以上にするため既定より濃くする |

### 既定のまま使うもの

`bg.muted`（セグメントの溝、保留中の注文の地）、`bg.subtle`、`bg.overlay`（シートの背後）、`fg.base`（本文）、`fg.muted`（補足、単位）、`fg.subtle`、`border.base`（カードの枠、区切り線）、`border.muted`。

### 追加するもの: `point.*`（ポイントの内訳の4区分）

内訳は、どの画面でも **通常 → SPU → マラソン → キャンペーン** の順に並べ、同じ見た目で区別する。色だけに頼らず、明度の差と模様で区別し、凡例には区分名を文字で添える。

| トークン | ライト | ダーク | 区別のしかた |
| --- | --- | --- | --- |
| `point.base` | `gray.300` | `gray.700` | 4区分で最も控えめ |
| `point.spu` | `gray.600` | `gray.400` | 通常と明度で区別する |
| `point.marathon` | `brand.500` | `brand.400` | 赤 |
| `point.campaign` | `amber.400` | `amber.300` | 必ず斜線の模様と組み合わせる（模様の地は `bg.panel`） |

## 部品ごとの使い分け

| 部品 | 使うトークン |
| --- | --- |
| ページ | 地 `bg.base`、文字 `fg.base` |
| カード、表、ボトムシート | プラン一覧とプロフィールは `Card.Root` の既定の `variant="panel"` と `size="md"`、プラン画面は `Card.Root variant="outline"`。中身は `Card.Body` に置く |
| サマリーカード | `Card.Root variant="solid" colorScheme="primary"`。ゲージは `Progress colorScheme="mono"`、内訳を開くボタンは `Button variant="subtle" colorScheme="mono"`。補足ラベル `primary.contrast/80`、未到達の買いまわりドット `blackAlpha.400`、到達済みのドット `primary.contrast` |
| サマリーカードの中の内訳 | 地 `bg.panel` の小さなパネルを置き、その上に `point.*` |
| 主要ボタン（追加する、保存） | `Button colorScheme="primary"`（solid）。ボトムバーの「注文を追加」は `size="xl"`、そのほかは `size="lg"`。画面を移るボタンは `RouterButton` |
| 補助のボタン（編集、コピー、貼り付け、続けて追加、キャンセル） | `Button variant="outline"`。プランの画面と注文の編集の「続けて追加」は `size="lg"`、注文の編集の「貼り付け」は既定の size |
| 控えめなボタン（リセット、並べ替え、行の取っ手と開閉の矢印、開閉の見出し） | `Button` / `IconButton` の `variant="ghost" colorScheme="gray" size="lg"` |
| 入力欄、選択欄 | `Field.Root`（`label`、`invalid`、`errorMessage`）の中に `Input` / `NativeSelect.Root`。プラン画面とプロフィールは `size="lg"`、注文の編集は既定の size。注文の編集の金額は `InputGroup.Root size="xl"` に `¥` の `InputGroup.Addon` |
| プラン設定の入力欄 | `Field` の中に既定の `Input`。キャンペーンの追加の日付は `DatePicker`（`locale="ja"`、`YYYY/MM/DD` の表示）。カレンダーは欄をタップしたときだけ開き、フォーカスや入力では開かない。ダイアログを開いたときに欄へ自動でフォーカスしない |
| キャンペーンの追加ダイアログ | 見出しの左に、追加するキャンペーンの画像（`boxSize="12"`）を置く |
| 入力欄のまとまり | `Fieldset.Root`（`legend`）。注文の編集の2つ目以降の商品は `variant="outline" size="sm"` |
| 買い回りにカウントするか | 表は `Checkbox colorScheme="primary" size="lg"`、カードは `Switch colorScheme="primary"` |
| 保留（注文の編集） | `Switch colorScheme="primary"` |
| 開いて見る設定（注文の編集の詳細設定） | `NativeAccordion`（variant は既定の plain） |
| 文中の追加ボタン（同じショップの商品を追加） | `Button variant="ghost" colorScheme="primary"` |
| 削除ボタン | `Button variant="outline" colorScheme="danger"`。プラン画面の注文の削除は `size="lg"` で、実行前に確認を挟む。注文の編集の「商品Nを削除」は既定の size。プラン一覧では `IconButton variant="ghost" colorScheme="danger" size="lg"`、プラン設定の並びでは `IconButton variant="ghost"` を使う |
| 画像で選ぶ選択肢（勝ったら倍の +1倍／+2倍） | `RadioCardGroup.Root colorScheme="primary" size="sm" withIndicator={false}` を2列に並べ、各 `RadioCard.Root` に画像、倍率（`RadioCard.Label`）、どんな日か（`RadioCard.Description`）を縦に置く |
| セグメントコントロール | 注文の編集の税率は `ButtonGroup.Root attached` の `Button`（選択中は `variant="solid" colorScheme="primary"`、ほかは `variant="outline"`、`aria-pressed`） |
| 選べるチップ | `Button colorScheme="mono" size="lg" aria-pressed`。未選択は `variant="outline"`、選択中は `variant="solid"` とチェックの印 |
| SPU のタイル | `CheckboxCard colorScheme="primary" size="sm" withIndicator={false}`（既定の surface）。名前は `Button variant="ghost" size="xs"` で、上限と条件のダイアログを開く |
| キャンペーンの ON / OFF | `CheckboxCard colorScheme="primary" size="sm"`（既定の surface とチェックの印） |
| 上限の印（SPU が上限に達した） | `Badge colorScheme="primary" variant="solid" fullRounded` |
| 表示だけのチップ（日付で自動のキャンペーン） | `Tag size="sm" variant="outline" fullRounded` |
| 順番バッジ | `Badge variant="solid" colorScheme="mono" fullRounded` |
| 保留中の注文 | カードは `Card.Root variant="outline"` の点線の枠、ポイントは `fg.muted` で取り消し線、バッジは「保留」の `Badge variant="outline" colorScheme="gray"` |
| プレビュー（この注文で何ポイント） | 強調の数値 `primary.fg` |
| 「あと何店舗回る？」の現在の行 | 地 `primary.subtle`、枠 `primary.outline`。残額の棒は `Progress`（現在の行は `colorScheme="primary"`、ほかは `"gray"`） |
| 警告 | `Alert.Root status="warning"`（既定の見た目） |
| サイドバー（右カラム） | トップ、Markdown のページ、お問い合わせに置く（`PageWithSidebar`）。PC は本文の右に幅 320px、`lg` 以下は本文の下。各区画は `SidebarSection`（`Card.Root` の既定の panel と `h2` の見出し）。お知らせの日付は `fg.muted` の `xs` |
| リンク | `Link`（既定の `colorScheme="link"`、`variant="plain"`）。アプリ内の移動は `RouterLink`（`Link` を TanStack Router の `createLink` で包んだもの）。行がまるごとリンクのときは `colorScheme="mono"` |
| オン・オフの切り替え（39ショップ） | `Switch colorScheme="primary"`（既定の `variant="thick"`）。ラベルを前に置くときは `reverse` |
| フォーカスリング | Yamada UI の既定（2px） |

## 文字

Noto Sans JP（Google Fonts）を使う。数値は常に等幅数字。

| 役割 | 大きさ / 行の高さ / 太さ | 例 |
| --- | --- | --- |
| 主役の数値 | 40px / 44px / 700 | 獲得予定 965P |
| 副次的な数値 | 24px / 30px / 700 | 還元率 8.6% |
| 見出し | 17px / 24px / 700 | 注文 |
| 本文 | 15px / 22px / 400 | ショップ名、商品名、ボタン |
| ラベル | 13px / 18px / 500 | 入力欄のラベル、表の見出し、チップ |
| 注記 | 12px / 16px / 400 | 税込・概算、倍率の補足 |

## 形と余白

| 値 | 用途 |
| --- | --- |
| 余白 4px | アイコンと文字の間 |
| 余白 8px | チップの間、ボタン群の間 |
| 余白 12px | スマホのカードの内側、リストの行間 |
| 余白 16px | スマホの左右の余白、セクションの間 |
| 余白 24px | PC のカラムの間と外側 |
| 角丸 8px | 入力欄、内訳バー |
| 角丸 12px | ボタン、セグメント、カード |
| 角丸 16px | サマリーカード、ボトムシートの上端 |
| 角丸 全円 | チップ、買いまわりドット、浮かせた追加ボタン |

タップ領域は 44px 以上にする。

### Yamada UI のトークン名への割り当て

Yamada UI の既定の目盛り（`1rem` = 16px）にそのまま当てはめる。テーマは変えない。余白は意味の名前（`gap="sm"` など）を使い、意味の名前がない 12px だけ数値の目盛り `3` を使う。

| 値 | トークン | 既定の定義 |
| --- | --- | --- |
| 余白 4px | `xs` | 意味のトークン `spaces.xs` → `1`（0.25rem） |
| 余白 8px | `sm` | `spaces.sm` → `2`（0.5rem） |
| 余白 12px | `3` | 数値の目盛り `3`（0.75rem）。意味のトークンはない |
| 余白 16px | `md` | `spaces.md` → `4`（1rem） |
| 余白 24px | `lg` | `spaces.lg` → `6`（1.5rem） |
| 角丸 8px | `lg` | `radii.lg`（0.5rem）。意味のトークン `l3` と同じ |
| 角丸 12px | `xl` | `radii.xl`（0.75rem）。`l4` と同じ |
| 角丸 16px | `2xl` | `radii.2xl`（1rem）。`l5` と同じ |
| 角丸 全円 | `full` | `radii.full`（9999px） |

## 部品の約束

- **買いまわりドット:** 10個を横に並べる。カウント済みは塗りつぶし、次の店舗は枠線だけ、残りは溝の色。
- **保留:** 上の表のとおり。保留中でも、含めた場合のポイントを参考に出す。
- **アイコン:** 操作を表すアイコンは線のアイコン（線幅 2px、角は丸）にする。SPU はサービスアイコンを使う。キャンペーン画像は角丸にせず、元画像の正方形を保つ。どちらも表示サイズを固定してレイアウトのずれを防ぐ。
