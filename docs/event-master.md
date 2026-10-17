# 公式イベントのマスタ

公式イベント（お買い物マラソンなど）のマスタは、D1 のデータベース `point-sprint-events` の表 `official_events` にある。Worker の Cron Triggers が楽天の告知ページから収集し、検査を通った回だけを公開する。トップページは、Worker が返す `/events.json` を開いたときに読み、終了日が今日以降のイベントだけを出す。デプロイしなくても、収集した回はトップページに出る。

スーパーSALE はまだ収集しない。読み取る処理は別に作る。

## 収集のしくみ

Worker（`apps/web/src/server/collect-events.ts`）が、日本時間の 10:05、16:05、22:05、04:05 に次の2ページを読む。1回の取得は2ページだけにする。User-Agent は一般的なブラウザのものを使う。

| ページ | URL | 読むもの |
|---|---|---|
| お買い物マラソンのスケジュール | https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/ | その月の各回の名前（「第二弾」）と期間 |
| お買い物マラソン | https://event.rakuten.co.jp/campaign/point-up/marathon/ | エントリー開始（開催の2日前の 10:00 ごろ）から終了までの回の、ポイントアップ期間、倍率、獲得上限 |

- 終了日が今日以降の回を、`marathon-<開始日>` の `id` で書き込む。一度公開した `id` は変えない。保存されたプランが `officialEventId` で参照している。
- マラソンのページにまだ出ていない回は、スケジュールのページの期間と、ガイドの倍率（10ショップで最大10倍）で公開し、上限は空にする。トップページには「上限は未発表」と出る。マラソンのページに出たら、そのページの倍率と上限で上書きする。
- スケジュールのページには、各回の上限の行がコメントアウトされて残っている。この行は実際と違うことがある（2026年10月の第一弾は「10,000ポイント」とあったが、開催中のページでは 7,000 ポイントだった）ので、読まない。
- 時刻は持てないので、期間は日付だけにする（#69）。
- 楽天のショッピング規約の第7条（禁止事項）は、自動化された手段での商品の購入（「商品ページ上の情報取得等を含む」）と、サーバーへの過度の負担を禁じている。告知ページを読むこと自体を禁じる条文はない（2026-10-17 に確認）。商品ページは読まない。

## 公開してよいかの検査

次のどれかに当たる回は公開しない。すでに公開している回は前の内容のまま残し、まだない回は `pending` で書き込む。

- `OfficialEventSchema` の形に合わない
- 期間が 2〜14 日の範囲にない
- 倍率（通常の1倍を含む）が 1〜20 倍の範囲にない
- 上限が 1,000〜100,000 ポイントの範囲にない
- マラソンのページの期間が、スケジュールのページのどの回とも一致しない
- マラソンのページのキャンペーン名が「お買い物マラソン」で始まらない

ページの作りが変わって読めないときも、その回は書き込まない。

## 担当と気づき方

- 担当はリポジトリの運営者。
- 収集のたびに、表 `collection_runs` に結果（`ok`、`warning`、`failed`）と理由を残す。
- 毎日 9:00 に、ワークフロー「Event master」（`.github/workflows/event-master.yml`）が `https://point-sprint.bmth.dev/events.json` を調べる。7 日後まで続くイベントが 1 つもないか、読めないと、Issue「公式イベントの収集を確かめる」を立てる。同じ題の Issue が開いていれば、新しく立てない。
- スケジュールのページは月ごとなので、月末の回が終わってから翌月のページが出るまでの間も Issue が立つことがある。そのときは翌月のスケジュールのページが出ているかを確かめる。

## Issue が立ったら

収集の記録を新しい順に見る。`apps/web` で実行する。

```sh
pnpm exec cf d1 query <データベースの ID> --sql "SELECT * FROM collection_runs ORDER BY id DESC LIMIT 10"
```

データベースの ID は `apps/web/cloudflare.config.ts` の `EVENTS_DB` にある。

- `failed` が続くとき: スケジュールのページが取れないか、読めない。ページを開いて作りが変わっていないかを確かめ、`apps/web/src/server/event-pages.ts` を直す。直したら、そのときのページを `apps/web/src/server/event-pages/` に固定してテストを足す。
- `warning` のとき: メッセージにある理由を見る。楽天の告知が正しく、検査が厳しすぎるなら検査を直す。

## 行を直すとき

誤った内容が公開されたときや、収集できない回を足すときは、行を直接直す。直した行は `locked = 1` にする。収集は `locked` の行と `rejected` の行を上書きしない。

```sh
# 公開をやめる
pnpm exec cf d1 query <ID> --sql "UPDATE official_events SET status = 'rejected', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 'marathon-2026-10-24'"

# 上限を直して固定する
pnpm exec cf d1 query <ID> --sql "UPDATE official_events SET benefits_json = json_set(benefits_json, '$[0].params.cap', 7000), locked = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 'marathon-2026-10-24'"
```

- 出典にするのは楽天の公式のページだけにする。まとめサイトや個人のブログの「予想」は使わない。
- `benefits_json` は `OfficialEventSchema` の `benefits` の形にする。形に合わない行は配信しない。
- 特典の `id` は UUID にする（`uuidgen | tr A-Z a-z`）。
- 終わったイベントは消さない。そのイベントから作ったプランが、名前の表示などに使っている。

## 表の形を変えるとき

`apps/web/migrations/` に SQL を足す。本番には Deploy のワークフローが、Preview には Preview のワークフローがデプロイの前に当てる。手元の開発サーバーと E2E は、起動のたびにローカルの D1 を作り直して当てる（`pnpm --filter web db:migrate --local`）。
