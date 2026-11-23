# Query Options と atom の責務

取得定義を Factory に統一し、公開する状態・購読・選択・複数状態の合成は atom に残す。
9 種類の Query は Repository または取得関数を受け取る Factory を呼ぶ。
上書き引数は実際の用途が生まれたときだけ追加し、queryKey と queryFn は固定する。
select を追加する場合は戻り値の型推論を保ち、派生 Factory は基底 Factory の引数を通す。
非購読の取得には基底 Factory を使い、選択には domain の関数を使う。

業務計算・抽出の純粋関数は domain に移す。保存形式、取得条件、フォールバック、
atom の依存と等価比較、画面の動作は維持する。

全体を一つの PR にまとめる案は取得定義と業務規則のレビューが混ざるため採用しない。
Query ごとに分割する案は同型の変更を細分化するため採用しない。
利用者と合意した 3 本の Stack PR とし、Factory、プラン計算、イベント選択の順に積む。

Options と atom はモジュールも分離する。state/queries.ts は queryKeys と Repository を受け取る Factory、state/query-atoms.ts は atom を持つ。公式イベントの Factory は routes/-official-events-query.ts に置く。Options のモジュールから Jotai・React hooks・ストレージ実装への依存を持たせない。

バンドルは同一の本番設定・固定 BUILD_ID と BUILD_DATE で PR 1 の分離前後を比較する。アプリ全体とトップページ初期配信の JS/CSS サイズ、および plansQueryOptions だけを公開する最小バンドルの依存を別々に確認する。実行速度の改善は主張しない。

Factory は appQueryOptions(factory) で定義し、呼び出しを (deps, options) に統一する。deps は Repository や load を持つオブジェクト、options は必要な Factory だけが持つ第 2 引数とする。各 Factory は Options のオブジェクトを返し、helper 内で queryOptions を適用する。引数の個数、取得元と select 後のデータ、queryKey の型推論を維持する。Options 不要の Factory に undefined や空オブジェクトを渡さない。トップレベル呼び出しが未使用 Factory を残さないことを最小バンドルで確認する。

バンドルの依存分離と未使用 Factory の除去は既存の Vitest テストに接続する。サイズ比較専用のスクリプトは常設せず、計測結果と当時のコードのコミット参照をレポートに残す。
