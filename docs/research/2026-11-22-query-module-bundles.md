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

## 再実行

同じスクリプトを比較する両リビジョンで実行する。古いリビジョンにスクリプトがない場合はコピーする。出力先はリビジョンごとに分ける。

```sh
cd apps/web
pnpm exec dotenvx run -q -f ../../.env.development -- node scripts/analyze-query-bundles.ts --out /tmp/query-bundles
```

app-sizes.json / app-sizes.md に配信量、app-modules.json にチャンク別のモジュールと残った export、probe.js / probe.json に Factory 単独の出力が残る。

分離後の最小バンドルの依存検査だけを行う場合:

```sh
pnpm exec node scripts/analyze-query-bundles.ts --out /tmp/query-probe --probe-only --assert-isolated
```

同じ検査は分離前のコードで失敗し、分離後に成功することを確認した。

## appQueryOptions 追加時の再検証（2026-11-23）

main の日付入力修正と依存更新を取り込んだ PR 1 の 29ee2e0 を基準に、同じ設定・lockfile のまま helper を追加した。上のモジュール分離の比較とは基準が異なるため、この節の値を上の表へ混ぜない。変更前後各 1 回のアプリビルドで、固定 BUILD_ID / BUILD_DATE は同じものを使用した。

| 対象 | raw: 前 → 後 | gzip: 前 → 後 | Brotli: 前 → 後 |
| --- | ---: | ---: | ---: |
| Factory 単独の診断 | 617 → 701 | 357 → 385 | 312 → 362 |
| 全アプリ | 1,849,106 → 1,849,259 | 616,973 → 616,939 | 527,278 → 527,204 |
| トップ初期ロード | 1,370,802 → 1,370,955 | 438,039 → 438,048 | 372,512 → 372,467 |

ファイル数は全アプリ 86、トップ初期ロード 42 のまま。Factory 単独の出力には queryOptions、appQueryOptions、使われる Factory と共通キー定義だけが残り、未使用 Factory・Jotai・Repository 実装は除去された。appQueryOptions は Factory をそのまま返す関数で、現在の Rolldown では PURE 注釈なしで検査が成功した。

トップ初期ロードの gzip 差は +9 bytes で、速度改善の根拠にはしない。引数の型と依存の規約を共通化し、既存の tree-shaking を維持できることを確認した。
