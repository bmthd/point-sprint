# 入力の検証

フォームの各項目が受け付ける値、エラーの文言、エラーを出す時機を定める。項目を足したり文言を変えたりしたときは、この表とテストを合わせて直す。

## 書き方

- 項目のスキーマは、正規化と検証の2段で書く。正規化（入力された文字列を値にする）は `apps/web/src/form/normalize.ts`、検証（値のルールとエラーの文言）は `apps/web/src/form/field-schemas.ts` に置く。項目のスキーマは `v.pipe(toNumber("yen"), 検証)` のように両者をつないだもので、すべてのフォームで共有する。項目名を引数に取るものは、文言にその項目名が入る。
- フォームの値は Formisch で持つ。Formisch のフィールドを Yamada UI の `Field`（`invalid`、`errorMessage`）につなぐ処理（`bind`、`errorsOf`）と、送信する `Form` は `apps/web/src/form/form.tsx` にある。
- その場で保存する欄（PC の注文一覧の行、買いまわりの設定、ショップ台帳）は、1項目だけの Formisch フォームである `CommitField`（`apps/web/src/form/commit-field.tsx`）を使う。
- エラーは項目の下に出す。文言は項目名と直し方を書く（「数量は1以上の整数で入れてください」）。エラーは入力欄の説明（`aria-describedby`）としても読み上げられ、入力欄には `aria-invalid` が付く。

## 正規化

検証の前に、入力された文字列を次のように整える（`normalize.ts`）。正規化ではエラーを出さない。数として読めない文字列は `NaN` に、空の欄は `undefined` にして、検証の側で文言を出す。

| 種類 | 整え方 |
|---|---|
| 数（`toNumber`） | NFKC で全角の数字と記号を半角にし、空白と桁区切りのカンマ、単位の記号を除く。単位の記号は金額が「¥」「円」、ポイントが「P」「ポイント」、倍率が「+」「倍」、数量が「個」。残りが符号付きの数字（小数を含む）なら数にし、それ以外は `NaN`、空なら `undefined` |
| 日付（`toDate`） | NFKC で半角にし、前後の空白を除く。空なら `undefined` |
| テキスト（`toText`） | 前後の空白を除く。全角の文字は変えない |
| URL（`toOptionalText`） | 前後の空白を除く。空なら `undefined` |

## エラーを出す時機

| 書き方 | 時機 |
|---|---|
| フォーム（`Form`） | 送信したときに全項目を検証する。エラーが出た項目は、そのあと入力のたびに検証し直す。送信時にエラーがあれば、画面の順で最初のエラー項目にフォーカスを移す。その項目が閉じた「詳細設定」の中にあれば、詳細設定を開く |
| その場で保存する欄（`CommitField`） | 欄を離れたとき、または Enter を押したときに検証し、正しければ保存する。エラーが出たあとは入力のたびに検証し直す。Esc で保存済みの値に戻す |
| PC の注文一覧の行の注文日 | 日付を変えたときに検証し、正しければ保存する |
| 選ぶ欄（`select`、スイッチ、チェックボックス） | 正しくない値は選べないので、エラーは出さない。ただし注文の追加と編集のフォームでは、ショップを選ばずに送信すると「ショップを選んでください」を出す |

## フォームと項目

「テスト」の列は、正しくない値でエラーが出ることを確かめるテストである。`unit` は `pnpm test` の単体テスト、`browser` はブラウザモードのテスト（`*.browser.test.tsx`）を指す。

### 注文の追加と編集（`order-editor/order-editor.tsx`、PC の一覧の `plan-home/order-add-form.tsx`）

どちらも `OrderFormSchema`（`order-editor/order-form.ts`）を使うフォームである。PC の一覧の追加フォームは、数量、クーポン値引額、保留、2つ目以降の商品を持たない。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| 商品のURL | 空、または `http://` か `https://` で始まる URL | 商品のURLは https:// で始まる形で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts`、browser `order-editor.browser.test.tsx` |
| ショップ | 台帳のショップか「＋ 新しいショップ」 | ショップを選んでください | unit `order-form.test.ts`、browser `order-editor.browser.test.tsx`、`order-table.browser.test.tsx` |
| 新しいショップの名前 | 新しいショップを選んだときだけ必須。1〜100文字 | ショップの名前を入れてください／ショップの名前は100文字以内で入れてください | unit `order-form.test.ts` |
| 注文日 | YYYY-MM-DD | 注文日を入れてください／注文日は YYYY-MM-DD の形で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts` |
| 金額（税込） | 0〜99,999,999 の整数（円） | 金額を入れてください／金額は0以上の整数で入れてください／金額は99,999,999円以下で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts`、browser `order-editor.browser.test.tsx`、`order-table.browser.test.tsx` |
| 商品名メモ | 0〜200文字 | 商品名メモは200文字以内で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts` |
| 税率 | 10%、8%、非課税 | （選ぶだけなので出ない） | — |
| 数量 | 1〜999 の整数 | 数量を入れてください／数量は1以上の整数で入れてください／数量は999以下で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts`、browser `order-editor.browser.test.tsx` |
| クーポン値引額（税込） | 空（0円）、または 0〜99,999,999 の整数で、金額×数量以下 | クーポン値引額は0以上の整数で入れてください／クーポン値引額は99,999,999円以下で入れてください／クーポン値引額は、金額に数量を掛けた額以下で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts`、browser `order-editor.browser.test.tsx` |
| ショップ独自倍率 | 空（独自倍率なし）、または 1〜100 の数 | ショップ独自倍率は1以上の数で入れてください／ショップ独自倍率は100以下で入れてください | unit `field-schemas.test.ts`、`order-form.test.ts` |
| 商品（全体） | 1件以上 | 商品を1つ以上入れてください | unit `order-form.test.ts` |

### 注文一覧の行（PC、`plan-home/order-row.tsx`）

その場で保存する欄である。商品が1件の注文だけ、商品名メモ、金額、ショップ独自倍率を直せる。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| 注文日 | YYYY-MM-DD | 注文日を入れてください／注文日は YYYY-MM-DD の形で入れてください | unit `field-schemas.test.ts` |
| 商品名メモ | 0〜200文字 | 商品名メモは200文字以内で入れてください | unit `field-schemas.test.ts` |
| 金額（税込） | 注文の追加と同じ | 注文の追加と同じ | unit `field-schemas.test.ts`、browser `order-table.browser.test.tsx`、`commit-field.browser.test.tsx` |
| ショップ独自倍率 | 注文の追加と同じ | 注文の追加と同じ | unit `field-schemas.test.ts` |
| ショップ、税率 | 選ぶだけ | （出ない） | — |

### キャンペーンの追加（`plan-settings/campaign-adder.tsx`）

キャンペーンのひな形ごとに出す項目が違う。スキーマは `plan-settings/campaign-form.ts` にある。日付、開始日、終了日は `DatePicker` で、`2026/10/06` の形で表示する。打ち込んだ文字が日付として読めないときは欄が空になり、「〜を入れてください」を出す。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| 名前 | 0〜50文字。空ならひな形の名前 | 名前は50文字以内で入れてください | unit `campaign-form.test.ts` |
| 日付 | YYYY-MM-DD | 日付を入れてください／日付は YYYY-MM-DD の形で入れてください | unit `campaign-form.test.ts` |
| 開始日 | YYYY-MM-DD | 開始日を入れてください／開始日は YYYY-MM-DD の形で入れてください | unit `campaign-form.test.ts` |
| 終了日 | YYYY-MM-DD で、開始日と同じ日かそれより後 | 終了日を入れてください／終了日は YYYY-MM-DD の形で入れてください／終了日は開始日と同じ日か、それより後の日にしてください | unit `campaign-form.test.ts`、browser `plan-settings.browser.test.tsx` |
| 倍率（+N倍） | 0より大きく100以下の数 | 倍率を入れてください／倍率は0より大きい数で入れてください／倍率は100以下で入れてください | unit `field-schemas.test.ts`、`campaign-form.test.ts` |
| 条件金額（円） | 0〜99,999,999 の整数 | 条件金額を入れてください／条件金額は0以上の整数で入れてください／条件金額は99,999,999円以下で入れてください | unit `campaign-form.test.ts` |
| 獲得上限（P） | 0〜99,999,999 の整数。ひな形によって必須か任意 | 獲得上限を入れてください／獲得上限は0以上の整数で入れてください／獲得上限は99,999,999ポイント以下で入れてください | unit `field-schemas.test.ts`、`campaign-form.test.ts`、browser `plan-settings.browser.test.tsx` |
| 倍率（勝ったら倍の +1倍／+2倍） | 画像のカードから選ぶだけ | （出ない） | — |

同じ日や同じ期間のキャンペーンがすでにあるときは、項目のエラーではなく「この日の〇〇はもう追加してあります」を出し、追加するボタンを押せなくする。

### 勝ったら倍の開催をまとめて追加（`plan-settings/sports-win-adder.tsx`）

勝ったら倍の編集欄の中にあるフォームである。開催日と倍率の組を何件でも入れ、「まとめて追加」で開催ごとに 1 件ずつ足す。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| 開催日 | YYYY-MM-DD で、プランにまだその日の勝ったら倍がない日 | 開催日を入れてください／開催日は YYYY-MM-DD の形で入れてください／この日の勝ったら倍はもう追加してあります | browser `plan-settings.browser.test.tsx` |
| 倍率 | +1倍、+2倍 | （選ぶだけなので出ない） | — |
| 開催日（全体） | 1件以上で、同じ日が2回ない | 開催日を1つ以上入れてください／同じ開催日が2回入っています | browser `plan-settings.browser.test.tsx` |

### 買いまわりと上限（`plan-settings/shop-around-settings.tsx`）

その場で保存する欄である。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| 開始日 | YYYY-MM-DD で、終了日と同じ日かそれより前 | 開始日を入れてください／開始日は YYYY-MM-DD の形で入れてください／開始日は終了日と同じ日か、それより前の日にしてください | browser `plan-settings.browser.test.tsx` |
| 終了日 | YYYY-MM-DD で、開始日と同じ日かそれより後 | 終了日を入れてください／終了日は YYYY-MM-DD の形で入れてください／終了日は開始日と同じ日か、それより後の日にしてください | browser `plan-settings.browser.test.tsx` |
| 獲得上限 | 0〜99,999,999 の整数 | 獲得上限を入れてください／獲得上限は0以上の整数で入れてください／獲得上限は99,999,999ポイント以下で入れてください | unit `field-schemas.test.ts`、browser `plan-settings.browser.test.tsx` |

### ショップ台帳（`profile/shop-registry.tsx`）

その場で保存する欄である。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| ショップの名前 | 1〜100文字 | ショップの名前を入れてください／ショップの名前は100文字以内で入れてください | unit `field-schemas.test.ts`、browser `profile.browser.test.tsx` |
| 39ショップ | スイッチ | （出ない） | — |

### SPU（`plan-settings/spu-tiles.tsx`）

SPU の各項目はスイッチで切り替えるだけで、文字を入れる項目はない。

### お問い合わせ（`inquiry/inquiry-form.tsx`）

スキーマ（`server/inquiry-input.ts`）はサーバーでも同じものでもう一度検証する。

| 項目 | 受け付ける値 | エラーの文言 | テスト |
|---|---|---|---|
| お名前（任意） | 0〜100文字 | お名前は100文字以内で入れてください | unit `inquiry-input.test.ts` |
| 返信先のメールアドレス | メールアドレスの形で、254文字以内 | 返信先のメールアドレスを入れてください／メールアドレスの形で入れてください／メールアドレスは254文字以内で入れてください | unit `inquiry-input.test.ts`、browser `inquiry-form.browser.test.tsx` |
| お問い合わせの内容 | 1〜5000文字 | お問い合わせの内容を入れてください／お問い合わせの内容は5000文字以内で入れてください | unit `inquiry-input.test.ts`、browser `inquiry-form.browser.test.tsx` |
| 返信を希望する | チェックボックス | （出ない） | — |
