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

`primary` を `brand` にすると、`primary.solid`（ライト 500 / ダーク 600）、`primary.contrast`（白）、`primary.fg`（700 / 100）、`primary.subtle`（50 / 950）、`primary.muted`、`primary.emphasized`、`primary.outline`、`primary.ghost` が自動で決まる。ただし赤の文字に使う `brand.base`（`color="link"`）と `primary.outline`（ゴースト・アウトラインのボタンの文字）は、ダークでは 400 にする。500 と 600 は暗い地に対して 4.5:1 に届かないため。塗りの `primary.solid` は白い文字を載せるので濃いままにする。リンクは Yamada UI の既定だと `colorScheme.solid` で塗りと同じ濃さになるため、必ず `color="link"` を付ける。`danger` と `primary` はどちらも赤系だが、削除などの危険な操作は必ず文言と確認の手順を伴わせ、色だけで区別しない。

## 画面全体のトークン

Yamada UI では、トークンの `base` の段は親の名前で参照する。`bg.base` は `bg="bg"`、`point.base` は `bg="point"` と書く（`bg="bg.base"` と書くと解決されない）。

### 既定から変えるもの

| トークン | ライト | ダーク | 理由 |
| --- | --- | --- | --- |
| `bg.base` | `#f4f5f7` | `#212328` | ページの地をわずかに青みのある灰にして、カード（`bg.panel`）を浮かせる。ダークは黒ではなく濃い灰にして、沈んで見えないようにする |
| `bg.panel` | `#ffffff` | `#2c2f35` | カード、表、シートの面。ダークは地より一段明るくする |
| `bg.muted` | `black.100` | `#41454e` | ゲージの溝、セグメントの溝、保留中の注文の地。ダークでは `bg.panel` の上で見えるよう一段明るくする |
| `bg.subtle` | `black.50` | `#363a42` | 棒グラフ（`Progress`）の溝など、面より一段だけ沈める地。ダークでは `bg.panel` と `bg.muted` の間にする |
| `border.base`・`border.muted` | `black.100` | `#3a3d44` | カードの枠（ダーク）、区切り線。ダークの面 `bg.panel` より一段明るくする |
| `border.emphasized` | `#8f8f8f` | `#8a8a8a` | 入力欄、ボタン、チェックボックスの枠。細い線でも地に溶けないよう、`bg.panel` の上で 4.5:1 前後にする |
| `fg.base` | `#171717` | `#fafafa` | 本文。ダークでは白に近づけ、暗い地でもくっきり読めるようにする |
| `fg.emphasized` | `gray.600` | `gray.100` | 本文に次ぐ文字 |
| `fg.muted` | `gray.500` | `gray.200` | 補足、単位。ダークの既定（`gray.400`）は `bg.panel` の上で 4.8:1 しかなく沈むため、7:1 以上にする |
| `fg.subtle` | `gray.400` | `gray.300` | いちばん控えめな文字。ダークでも `bg.panel` の上で 4.5:1 以上にする |

### 既定のまま使うもの

`bg.overlay`（シートの背後）。ライトの `border.base`（区切り線）と `border.muted`。

### 追加するもの: `point.*`（ポイントの内訳の4区分）

内訳は、どの画面でも **通常 → SPU → マラソン → キャンペーン** の順に並べ、同じ見た目で区別する。色だけに頼らず、明度の差と模様で区別し、凡例には区分名を文字で添える。

| トークン | ライト | ダーク | 区別のしかた |
| --- | --- | --- | --- |
| `point.base` | `gray.300` | `gray.500` | 4区分で最も控えめ |
| `point.spu` | `gray.600` | `gray.300` | 通常と明度で区別する |
| `point.marathon` | `brand.500` | `brand.400` | 赤 |
| `point.campaign` | `amber.400` | `amber.300` | 必ず斜線の模様と組み合わせる（模様の地は `bg.panel`） |

## 部品ごとの使い分け

| 部品 | 使うトークン |
| --- | --- |
| ページ | 地 `bg.base`、文字 `fg.base` |
| カード、表、ボトムシート | `Card.Root` の既定の `variant="panel"` と `size="md"`。地 `bg.base` の上に白い面 `bg.panel` を浮かせる。中身は `Card.Body` に置く。面の見た目はレイヤースタイル `panel` で決める。ライトは枠線の代わりにごく薄い影で浮かせ、ダークは枠線で区切る。角丸は `l4`（12px） |
| サマリーカード | `Card.Root variant="solid" colorScheme="primary" rounded="l4"`。次に上限に届く特典の 1 行は地 `blackAlpha.400`、内訳を開くボタンは `Button variant="subtle" colorScheme="mono"`。補足ラベル `primary.contrast/80`、未到達の買いまわりドット `blackAlpha.400`、到達済みのドット `primary.contrast` |
| サマリーカードの中の内訳 | 地 `bg.panel` の小さなパネルを置き、その上に `point.*` |
| 主要ボタン（追加する、保存） | `Button colorScheme="primary"`（solid）。ボトムバーの「注文を追加」は `size="xl"`、そのほかは `size="lg"`。画面を移るボタンは `RouterButton` |
| 補助のボタン（編集、コピー、貼り付け、続けて追加、キャンセル） | `Button variant="outline"`。`outline` は面を塗らないので、地 `bg.base` の上に置くときは `bg="bg.panel"` を付ける。プランの画面と注文の編集の「続けて追加」は `size="lg"`、注文の編集の「貼り付け」は既定の size |
| 控えめなボタン（リセット、並べ替え、行の取っ手と開閉の矢印、開閉の見出し、PC のプランの設定） | `Button` / `IconButton` の `variant="ghost" colorScheme="gray" size="lg"` |
| 入力欄、選択欄 | `Field.Root`（`label`、`invalid`、`errorMessage`）の中に `Input` / `NativeSelect.Root`。プラン画面とプロフィールは `size="lg"`、注文の編集は既定の size。注文の編集の金額は `InputGroup.Root size="xl"` に `¥` の `InputGroup.Addon`。面は `bg.panel`、枠は `border.emphasized`（エラーのときは `border.error`）。Yamada UI の `outline` は面を塗らないので、ルートの `FormControlDefaults` で `Input`、`Textarea`、`NativeSelect`、`DatePicker` にまとめて渡す。これは Yamada UI の CLI が部品のスタイルの一部だけを上書きできるようになるまでの仮の置き方で、そうなったら CLI で `outline` を上書きして `FormControlDefaults` を消す。選択欄はスマホで OS のピッカーを使うため `NativeSelect` にする |
| プラン設定の入力欄 | `Field` の中に既定の `Input` |
| 日付の入力欄 | 注文日（注文の編集、プラン画面の追加フォームと行）、キャンペーンの追加とプラン設定の日付と期間は `DatePicker`（`locale="ja"`、`YYYY/MM/DD` の表示）。カレンダーは欄をタップしたときだけ開き、フォーカスや入力では開かない。タップで画面のキーボードは出さない（`inputMode="none"`）が、物理キーボードでは打ち込める。ダイアログを開いたときに欄へ自動でフォーカスしない |
| キャンペーンの追加ダイアログ | 見出しの左に、追加するキャンペーンの画像（`boxSize="12"`）を置く |
| 入力欄のまとまり | `Fieldset.Root`（`legend`）。注文の編集の2つ目以降の商品は `variant="outline" size="sm"` |
| 買い回りにカウントするか | 表は `Checkbox colorScheme="primary" size="lg"`、カードは `Switch colorScheme="primary"` |
| 保留（注文の編集） | `Switch colorScheme="primary"` |
| 開いて見る設定（注文の編集の詳細設定） | `NativeAccordion`（variant は既定の plain） |
| 文中の追加ボタン（同じショップの商品を追加） | `Button variant="ghost" colorScheme="primary"` |
| 削除ボタン | `Button variant="outline" colorScheme="danger"`。プラン画面の注文の削除は `size="lg"` で、実行前に確認を挟む。注文の編集の「商品Nを削除」は既定の size。プラン一覧では `IconButton variant="ghost" colorScheme="danger" size="lg"`、プラン設定の並びでは `IconButton variant="ghost"` を使う |
| 画像で選ぶ選択肢（勝ったら倍の +1倍／+2倍） | `RadioCardGroup.Root colorScheme="primary" size="sm" withIndicator={false}` を2列に並べ、各 `RadioCard.Root` に画像、倍率（`RadioCard.Label`）、どんな日か（`RadioCard.Description`）を縦に置く |
| セグメントコントロール | 税率（注文の入力欄と「上限までの残り」）は `SegmentedControl.Root` に `taxRateSegmentsStyle`。入力欄と同じく地 `bg.panel`・枠 `border.emphasized`、選んだものは地 `primary.subtle`・枠 `primary.outline`・文字 `primary.fg`。Yamada UI の既定（灰の溝に白い札）は周りの入力欄から浮くため使わない |
| 選べるチップ | `Button colorScheme="mono" size="lg" aria-pressed`。未選択は `variant="outline"`、選択中は `variant="solid"` とチェックの印 |
| SPU のタイル | `CheckboxCard colorScheme="primary" size="sm" withIndicator={false}`（既定の surface）。名前は `Button variant="ghost" size="xs"` で、上限と条件のダイアログを開く |
| キャンペーンの ON / OFF | `CheckboxCard colorScheme="primary" size="sm"`（既定の surface とチェックの印） |
| 上限の印（SPU が上限に達した） | `Badge colorScheme="primary" variant="solid" fullRounded` |
| 表示だけのチップ（日付で自動のキャンペーン） | `Tag size="sm" variant="outline" fullRounded` |
| 順番バッジ | `Badge variant="solid" colorScheme="mono" fullRounded` |
| 保留中の注文 | カードは点線の枠（`borderStyle="dashed"`）、ポイントは `fg.muted` で取り消し線、バッジは「保留」の `Badge variant="outline" colorScheme="gray"` |
| プレビュー（この注文で何ポイント） | 強調の数値 `primary.fg` |
| 「あと何店舗回る？」の現在の行 | 地 `primary.subtle`、枠 `primary.outline`。上限までの満たし具合の棒は `Progress`（上限に届く行は `colorScheme="success"`、現在の行は `"primary"`、ほかは `"gray"`） |
| 上限までの残り | 行は `List`。枠の単位は `Badge variant="outline" colorScheme="gray" fullRounded`。ゲージは 2 色に分けるため `Progress` ではなく帯を組む（ほかのプランの分 `gray.solid`、このプランの分 `primary.solid`、溝 `bg.muted`）。税率の切り替えは、注文の入力欄の税率と同じ `SegmentedControl`（`size="sm"`） |
| 警告 | `Alert.Root status="warning"`（既定の見た目） |
| サイドバー（右カラム） | 読むページ（トップ、Markdown のページ、お問い合わせ、お知らせ）に置く（`PageWithSidebar`）。プランとプロフィールのような作業するページには置かない。PC は本文の右に幅 320px、`lg` 以下は本文の下。各区画は `SidebarSection`（`Card.Root` の既定の panel と `h2` の見出し） |
| 読むページの本文 | Markdown のページ（使い方、利用規約、プライバシーポリシー、ガイドの記事）は、本文を `Card.Root` に載せる（`PageWithSidebar` の `card`）。見出しもカードの中に置き、PC ではカードの上端をサイドバーの最初のカードにそろえる。お知らせとお問い合わせは、見出しの行（`ColumnHead`）の下に本文のカードを置く。ガイドの一覧は、記事ごとのカードを並べるので、外側のカードに載せない。本文のカードの中の囲み（使い方の手順のタイムライン、ガイドの商品の一覧）は、`insetCardProps` で枠と影を外し、地 `bg.subtle` で一段沈める |
| トップのイベント欄 | `Tabs.Root size="sm"`（既定の `variant="line"`）で「開催中・開催予定」と「終了」に分ける。タブは見出し「イベント」の行（`ColumnHead`）の右に置き、カードの上端をサイドバーのカードにそろえる。開催中・開催予定がないときは「終了」を開いて出す。状態のバッジは開催中 `Badge colorScheme="primary" variant="solid"`、開催予定 `colorScheme="mono" variant="outline"`、終了 `colorScheme="gray" variant="subtle"`。終わって 30 日を過ぎたイベントは「もっと見る」の `Drawer`（スマホは `block-end`、PC は `inline-end`）に、月ごとの `Card` の行で並べ、行のボタンは `Button variant="outline"` |
| お知らせ | 本文は `/notices` に新しい順にすべて並べる（幅 640px）。サイドバーには最新3件の日付と題名だけを置き、題名は `/notices#<id>` へのリンクにする。`/notices` 自身のサイドバーには出さない。日付は `fg.muted` の `xs` |
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
