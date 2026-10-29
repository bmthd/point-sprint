# 公式イベントのマスタ

公式イベント（お買い物マラソンなど）のマスタは、D1 のデータベース `point-sprint-events` の表 `official_events` にある。Worker の Cron Triggers が楽天の告知ページから収集し、検査を通った回だけを公開する。トップページは、Worker が返す `/events.json` を開いたときに読み、終了日が今日以降のイベントだけを出す。デプロイしなくても、収集した回はトップページに出る。お買い物マラソンの日程と上限のページ（`/marathon`）も、Worker がリクエストのたびにマスタから描くので、デプロイしなくても新しい回が HTML に入る。

スーパーSALE はまだ収集しない。読み取る処理は別に作る。大型の期間イベント（ブランドデーなど）も収集しない。回が告知されたら、運営者が「大型の期間イベント」の手順で行を足す。

## 収集のしくみ

Worker（`apps/web/src/server/official-events/collect-events.ts`）が、日本時間の 10:05、16:05、22:05、04:05 に次の2ページを読む。1回の取得は2ページだけにする。User-Agent は一般的なブラウザのものを使う。

| ページ | URL | 読むもの |
|---|---|---|
| お買い物マラソンのスケジュール | https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/ | その月の各回の名前（「第二弾」）と期間 |
| お買い物マラソン | https://event.rakuten.co.jp/campaign/point-up/marathon/ | エントリー開始（開催の2日前の 10:00 ごろ）から終了までの回の、ポイントアップ期間、倍率、獲得上限 |

- 終了日が今日以降の回を、`marathon-<開始日>` の `id` で書き込む。一度公開した `id` は変えない。保存されたプランが `officialEventId` で参照している。
- マラソンのページにまだ出ていない回は、スケジュールのページの期間と、ガイドの倍率（10ショップで最大10倍）で公開し、上限は空にする。トップページには「上限は未発表」と出る。マラソンのページに出たら、そのページの倍率と上限で上書きする。
- スケジュールのページには、各回の上限の行がコメントアウトされて残っている。この行は実際と違うことがある（2026年10月の第一弾は「10,000ポイント」とあったが、開催中のページでは 7,000 ポイントだった）ので、読まない。
- 期間の初日の開始時刻と最終日の終了時刻（「20:00」「01:59」）は、`period_start_time` と `period_end_time` に入れる。トップページに出し、プランでは初日・最終日の注文に「この時刻の外の注文は対象外」と注意を出す。プランの計算は日付だけで判定する（#69）。
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

- `failed` が続くとき: スケジュールのページが取れないか、読めない。ページを開いて作りが変わっていないかを確かめ、`apps/web/src/server/official-events/event-pages.ts` を直す。直したら、そのときのページを `apps/web/src/server/official-events/event-pages/` に固定してテストを足す。
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

## 大型の期間イベント

期間中の合計額（税込）で倍率が決まる 2〜3 日のイベント。特典は `spend-tiers` で表し、`params.tiers` に「合計額の下限（円）→ 上乗せの倍率」を並べる。倍率は公式の「ポイント N 倍」から通常の 1 倍を引いた値にする。上限は開催ごとなので、`capScope` は `"campaign"`、`sharedKey` は行の `id` にする（マラソンと同じ）。

| イベント | 出典にするページ | `id` | 回ごとに確かめること |
|---|---|---|---|
| 楽天ブランドデー | https://event.rakuten.co.jp/brand/campaign/ | `brand-day-<開始日>` | 期間、段階（2026-10 は 30,000 円未満で +2 倍、以上で +4 倍）、上限（4,000）。対象は対象アイテムだけなので、`conditions.orderTags` を `["brand-day"]` にする |
| 楽天イーグルス感謝祭 | https://event.rakuten.co.jp/campaign/eagles/thanks/ | `eagles-thanks-<開始日>` | 期間、段階。最上段の金額が回ごとに違う（2024 は 50,000 円、2025 は 45,000 円で +4 倍）。上限（5,000） |
| 新春ポイントアップ祭 | https://event.rakuten.co.jp/newyear/campaign/pointup/ | `newyear-pointup-<開始日>` | 期間（1 月 1〜3 日）、段階（2026 は 5,000・10,000・30,000・45,000 円で +1・+2・+4・+6 倍）、上限（5,000） |
| 超ポイントバック祭 | https://event.rakuten.co.jp/campaign/pointback/ | `pointback-<開始日>` | 期間、段階。回ごとに違う（2026-05 は 5 段で最大 +5 倍、2025-12 は 4 段で最大 +4 倍）。上限（5,000） |

- 段階は毎回、公式ページの「キャンペーン詳細」の「特典内容」から写す。前の回の値を使い回さない。
- ブランドデーは、ページ上部と「キャンペーン詳細」で条件金額が食い違ったことがある（上部に「期間中のお買い物金額合計10,000円(税込)以上」とあった）。「キャンペーン詳細」の「特典内容」に従う。2026-10 の回は、上部の行が HTML のコメントになっていて、特典内容に下限がないので、最初の段を 0 円にした。この回は `apps/web/migrations/0002_brand_day_2026_10.sql` で入れた。
- 期間は「ポイントアップ期間」。エントリー期間ではない。時刻もこの期間のものを `period_start_time` と `period_end_time` に入れる。分からなければ空にする。プランには「時刻によっては対象外」と出る。
- 超ポイントバック祭は告知なしで始まり、マスタに入るまでに開催の一部が過ぎる。その間は、プランの設定のキャンペーン「超ポイントバック祭」（直近の回の段階が入ったテンプレート）を足し、段階を直してもらう。
- バナーは `.webp` にして R2 の `/img/campaign/` に置き、特典の `imagePath` に書く。

行は次の形で足す。特典の `id` は UUID にする。

```sh
pnpm exec cf d1 query <ID> --sql "INSERT INTO official_events (id, name, period_start, period_end, period_start_time, period_end_time, benefits_json, source_url, locked, status) VALUES ('pointback-2026-05-19', '超ポイントバック祭', '2026-05-19', '2026-05-20', NULL, NULL, '[{\"id\":\"<UUID>\",\"kind\":\"spend-tiers\",\"category\":\"campaign\",\"label\":\"超ポイントバック祭\",\"enabled\":true,\"amountBasis\":\"tax-excluded\",\"capScope\":\"campaign\",\"sharedKey\":\"pointback-2026-05-19\",\"conditions\":{\"dateRule\":{\"type\":\"range\",\"start\":\"2026-05-19\",\"end\":\"2026-05-20\"}},\"params\":{\"tiers\":[{\"minAmount\":5000,\"rate\":1},{\"minAmount\":10000,\"rate\":2},{\"minAmount\":20000,\"rate\":3},{\"minAmount\":40000,\"rate\":4},{\"minAmount\":60000,\"rate\":5}],\"cap\":5000,\"roundingUnit\":\"item\"}}]', 'https://event.rakuten.co.jp/campaign/pointback/', 1, 'published')"
```

`benefits_json` に新しい `orderTags` の値を使う行は、その値を読めるアプリをデプロイしてから足す。前の版の Worker は、読めない行を配信しない。

## 表の形を変えるとき

`apps/web/migrations/` に SQL を足す。本番には Deploy のワークフローが、Preview には Preview のワークフローがデプロイの前に当てる。手元の開発サーバーと E2E は、起動のたびにローカルの D1 を作り直して当てる（`pnpm --filter web db:migrate --local`）。開発サーバーは、起動したまま足されたマイグレーションも、次に D1 を読むときに当てる（`apps/web/src/server/shared/dev-migrations.worker.ts`）。
