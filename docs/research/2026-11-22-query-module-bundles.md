# Query Options のモジュール分離とバンドル

## 結果

Options だけを import する入口から Jotai とストレージ実装を除去できた。
アプリ全体の配信量は減らず、トップページ初期配信の gzip 合計は 2,019 bytes 増えた。
今回の変更は依存の分離として採用し、実行速度の改善は主張しない。

## 比較条件

- 分離前は PR 1 の b8a6d05。分離後も PR 1 の範囲で比較し、PR 2・3 の domain 移動は含めない。
- 同じ lockfile、Vite 8.3.3 / Rolldown 1.2.12、production 設定、.env.development を使用。
- BUILD_ID は query-module-audit、BUILD_DATE は 2026-11-22 に固定し、内容のないハッシュ差を抑えた。
- アプリは createBuilder().buildApp() と既存の check-prerender.ts を実行。計測は既存の bundle-size.ts。
- アプリは変更前後各 1 ビルド。所要時間は比較しない。最小バンドルは変更後を再実行し、同一コード・同一サイズを確認。
- 最小バンドルは Vite の library mode で plansQueryOptions だけを export する別の診断用ビルド。本番アプリの転送量ではない。

## サイズ

単位は bytes。gzip は level 9、Brotli は Node の既定値。アプリは出力された JS/CSS の合計で、HTML・画像・フォント・source map・API 応答を含まない。

| 対象 | raw: 前 → 後 | gzip: 前 → 後 | Brotli: 前 → 後 |
| --- | ---: | ---: | ---: |
| Whole app | 1,843,479 → 1,843,553 | 614,822 → 616,445 | 523,691 → 527,059 |
| Top page, initial render | 1,367,093 → 1,368,417 | 435,670 → 437,689 | 368,555 → 372,157 |
| plansQueryOptions probe | 86,769 → 617 | 22,020 → 357 | 19,340 → 312 |

## 何が残り、何が消えたか

最小バンドルの変更前には plansQueryOptions 以外の Factory、atomWithQuery、Jotai の atom、queryClientAtom、メモリ Repository とその依存が残っていた。変更後にコードを持つモジュールは queries.ts と TanStack Query の queryOptions.js の 2 つだけになった。公開される Factory は plansQueryOptions だけで、Jotai・React・Repository 実装は出力にない。

queryKeys は一つのオブジェクトなので、最小バンドルにも 9 種類のキーの文字列は残る。除去できたのは未使用 Factory の処理とその実装依存であり、キー定義まで一件だけになったわけではない。

アプリでは各 Query が使われているため、Factory 自体は残る。トップページの初期ロードにもこれらの取得定義が入っている。Options の分離だけでページ単位の遅延読み込みまで保証するものではない。

## チャンクの変化

- 全アプリの JS/CSS は 79 → 86 ファイル、トップページ初期ロードは 35 → 42 ファイル。
- モジュール一覧を比較すると、新たに残ったソースは分離先の query-atoms.ts と -official-events-query.ts だけ。依存パッケージや他の業務モジュールの追加はない。
- 元の queries チャンクがなくなり、Options は dist、atom は index に入った。createServerFn、-plan-search、result-card、sidebar-section、dates、lazyRouteComponent、articles のチャンクが別になった。
- 全体 raw の差は +74 bytes。一方、チャンクごとの圧縮と import/export・preload の境界が変わり、全体 gzip は +1,623 bytes、初期ロード gzip は +2,019 bytes になった。

ファイル数と圧縮後サイズの増加は確認できたが、通信時間や描画時間は測定していない。手動のチャンク固定や Query ごとのファイル分割は、この結果だけでは追加しない。

## 計測コードの参照と継続検査

今回限りのサイズ比較スクリプトは削除した。上の比較で使用したコードは [22f08b4 の analyze-query-bundles.ts](https://github.com/bmthd/point-sprint/blob/22f08b4/apps/web/scripts/analyze-query-bundles.ts) を参照する。サイズ比較を再現する場合は、比較対象ごとの作業環境でこの版のスクリプトを使い、出力先を分ける。通常の配信サイズの計測は、既存 CI の bundle-size.ts が引き続き受け持つ。

未使用 Factory・Jotai・ストレージ実装の除去検査は state/query-options-bundle.test.ts に移した。既存の pnpm test と CI から実行される。アプリのビルド設定や外部 API を呼ばず、メモリ上で Factory だけのバンドルを検査する。

対象の検査だけを実行する場合:

```sh
pnpm test --project web apps/web/src/state/query-options-bundle.test.ts
```

Options と atom が同居していた b8a6d05 の queries.ts を一時的に戻すと検査が失敗し、現在の実装に戻すと成功することを確認した。また、未使用 Factory をトップレベルの副作用で保持させた場合も失敗することを確認した。

## appQueryOptions 追加時の再検証（2026-11-23）

main の日付入力修正と依存更新を取り込んだ PR 1 の 29ee2e0 を基準に、同じ設定・lockfile のまま helper を追加した。上のモジュール分離の比較とは基準が異なるため、この節の値を上の表へ混ぜない。変更前後各 1 回のアプリビルドで、固定 BUILD_ID / BUILD_DATE は同じものを使用した。

| 対象 | raw: 前 → 後 | gzip: 前 → 後 | Brotli: 前 → 後 |
| --- | ---: | ---: | ---: |
| Factory 単独の診断 | 617 → 701 | 357 → 385 | 312 → 362 |
| 全アプリ | 1,849,106 → 1,849,259 | 616,973 → 616,939 | 527,278 → 527,204 |
| トップ初期ロード | 1,370,802 → 1,370,955 | 438,039 → 438,048 | 372,512 → 372,467 |

ファイル数は全アプリ 86、トップ初期ロード 42 のまま。Factory 単独の出力には queryOptions、appQueryOptions、使われる Factory と共通キー定義だけが残り、未使用 Factory・Jotai・Repository 実装は除去された。appQueryOptions は Factory をそのまま返す関数で、現在の Rolldown では PURE 注釈なしで検査が成功した。

トップ初期ロードの gzip 差は +9 bytes で、速度改善の根拠にはしない。引数の型と依存の規約を共通化し、既存の tree-shaking を維持できることを確認した。

## queryOptions の適用を共通関数へ移した場合（2026-11-23）

基準は bf33daa。各 Factory 内の queryOptions を除き、appQueryOptions 内でまとめて適用した。同じ設定と固定 BUILD_ID / BUILD_DATE のビルド結果を比較した。変更前のアプリ値は直前の節で測定した同一リビジョンの成果物を使用し、変更後は 1 回ビルドした。

| 対象 | raw: 前 → 後 | gzip: 前 → 後 | Brotli: 前 → 後 |
| --- | ---: | ---: | ---: |
| Factory 単独の診断 | 701 → 719 | 385 → 396 | 362 → 352 |
| Whole app | 1,849,259 → 1,849,249 | 616,939 → 616,977 | 527,204 → 527,138 |
| Top page, initial render | 1,370,955 → 1,370,945 | 438,048 → 438,074 | 372,467 → 372,341 |

全アプリ 86、トップ初期ロード 42 ファイルのまま。未使用 Factory・Jotai・Repository 実装の除去は維持され、PURE 注釈なしで検査が成功した。queryKey のリテラル・キャッシュの DataTag・generic select の型推論も実装の型テストで確認した。型アサーションや any は使用していない。
