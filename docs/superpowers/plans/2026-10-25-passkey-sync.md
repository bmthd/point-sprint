# パスキーでの同期 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 希望した人がパスキーでログインし、PC とスマホで同じプラン・注文・ショップ・プロフィール・SPU を使えるようにする。サーバーには読めないデータしか置かない。

**Architecture:** 端末の IndexedDB が今までどおり正本で、書くたびに「送るもの」（outbox）に印を付ける。同期は 1 件ずつの暗号の塊を Worker + D1（`SYNC_DB`）とやり取りし、`updatedAt` のあと勝ちで合わせる。データの鍵はランダムな 32 バイトで、PRF から作った鍵と復元用のコードから作った鍵で包んだものだけをサーバーに置く。

**Tech Stack:** WebAuthn（`@simplewebauthn/server` 14 と `@simplewebauthn/browser`）、WebCrypto（AES-GCM、HKDF、HMAC）、Cloudflare D1、TanStack Start の `createServerFn`、seitu の IndexedDB、Yamada UI v2、Playwright の WebAuthn 仮想認証器。

**Spec:** Issue #230 の本文と、決めたことのコメント（[PRF の調査](https://github.com/bmthd/point-sprint/issues/230#issuecomment-6398640038)、[PRF で開けない端末](https://github.com/bmthd/point-sprint/issues/230#issuecomment-6398694260)、[パスキーだけ](https://github.com/bmthd/point-sprint/issues/230#issuecomment-6398727270)）。

## この計画で決めたこと（Issue の「決めること」）

| 項目 | 決めたこと |
| --- | --- |
| PRF で開けない端末 | 初回だけ復元用のコードを入れてもらう（利用者と相談済み） |
| ログイン | パスキーだけ（利用者と相談済み） |
| 入口 | `/profile` の「ほかの端末と同期」の節だけ（利用者と相談済み） |
| 悪用への備え | 始めるときだけ Turnstile。上限は 1 人 10MB、1 件 64KB、1 時間に 600 回の書き込み（利用者と相談済み） |
| 注文 1 件ずつのあと勝ち | 注文を `orders` ストアに分け、`planId`・`position`・`updatedAt` を持たせる。`Plan` 型（`orders` 配列つき）は画面と計算ではそのまま使い、リポジトリが組み立てる |
| 同期のきっかけ | アプリを開いたとき、書いてから 2 秒後（まとめて送る）、タブが前に出たとき、`online` になったとき |
| 復元用のコード | 128 ビットの乱数を Crockford Base32 で 26 文字にし、4 文字ずつ `-` で区切る（例 `K7QM-3XRP-...`）。始めるときに 1 回だけ見せ、「控えました」にチェックするまで先へ進ませない |

## Global Constraints

- 返答・画面・文書は日本語。画面では「パスキー」をそのまま書き、「顔認証・指紋」などに言い換えない
- サーバーに氏名・メールアドレス・楽天 ID を送らない。WebAuthn の `user.name` / `displayName` は「ポイントスプリント」と固定の文字列にする
- **PRF の出力と、データの鍵と、復元用のコードは、どんな形でもサーバーに送らない。** `clientExtensionResults` はサーバーに送る前に `prf` を消す
- サーバーが持つ平文は、レコードの ID（データの鍵から作った HMAC。中身の ID ではない）、`updatedAt`、データのバージョン、消したかどうか、だけ
- 同期のデータベースは `SYNC_DB`（本番 `point-sprint-sync`、Preview `point-sprint-sync-preview`）。`EVENTS_DB` は使わない。マイグレーションは `apps/web/migrations-sync/`
- `CURRENT_SCHEMA_VERSION` を 10 → 11 に上げる（AGENTS.md）
- 自分のバージョンより新しいレコードを受け取ったら、同期を止めて `OutdatedDatabaseError` と同じ再読み込みのダイアログを出す。サーバーは、そのアカウントにすでにあるバージョンより古いバージョンの書き込みを `409 outdated` で断る
- ファイルの置き場所は AGENTS.md に従う。React に依存しない合わせ方と保存の形は `packages/domain`、端末側の同期は `apps/web/src/storage/`、サーバーは `apps/web/src/server/`、画面は `/profile` だけが使うので `routes/(plan)/-profile/`
- 画面の部品は `@workspaces/ui` から探す（`Card`、`Alert`、`Modal`、`Checkbox`、`Input`、`Code`、`useClipboard`、`Status` など）。自作するときは理由を PR に書く
- 見た目やライブラリの機能はテストしない（パスキーのダイアログが出ること、など）。テストは自分たちの振る舞いだけ
- PR を作る・マージするのは、利用者が見た目とコードを確かめてから

## Review Focus

1. **時計がずれた 2 台**: スマホの時計が 5 分進んでいると、PC であとから直した注文が負ける。あと勝ちは端末の時計を信じる、と割り切る。ただし、未来すぎる `updatedAt`（サーバーの時刻より 1 日以上先）はサーバーが断る → Task 7 にテストを足す
2. **同じ注文を移動しただけで、ほかの注文が「直した」ことにならない**: 並べ替えで他の注文の `position` を書き換えると、別の端末で直したその注文を消してしまう → Task 1 の `orderPositions` に「動かした 1 件だけが変わる」テストを足す
3. **消したプランの注文が、別の端末から戻ってくる**: プランを消した端末と、同じプランに注文を足した端末が同時に送ると、親のない注文が残る → 組み立てるときに親のない注文は出さない（Task 3 にテスト）
4. **PRF の値がずれた端末が、正しい包みを上書きする**: 復元用のコードで開けた端末が、ずれた PRF でその credential の包みを書き直すと、正しく開けていた端末が開けなくなる → 包みを持つ credential には書き直さない（Task 9 にテスト）
5. **書いた直後にタブを閉じる**: 2 秒待つ間にタブを閉じても、outbox に残るので次に開いたときに送られる → Task 3 で「put と outbox が同じトランザクション」のテストを足す

---

## ファイルの地図

| ファイル | 役割 |
| --- | --- |
| `packages/domain/src/model/stored-plan.ts`（新規） | `PlanRowSchema`（`orders` なし）、`OrderRowSchema`（`Order` + `planId`・`position`・`updatedAt`）、`splitPlan` / `joinPlan` |
| `packages/domain/src/plan-ops/order-positions.ts`（新規） | 並びを変えたときに、変わる注文をなるべく少なくする `position` の振り方 |
| `packages/domain/src/migrations/v11-order-rows.ts`（新規） | プランから注文を `orders` ストアへ移す |
| `packages/domain/src/sync/records.ts`（新規） | 同期するレコードの種類、`SyncRow`、あと勝ちの判定 `isNewer` |
| `apps/web/src/storage/indexed-db-repository.ts` | `orders`・`outbox`・`tombstones`・`syncMeta` ストア、プランの組み立てと差分、同期用の口 |
| `apps/web/src/storage/memory-repository.ts` | 同じ口をメモリで |
| `apps/web/src/storage/repository.ts` | `Repository` に `sync` を足す |
| `apps/web/src/storage/sync-crypto.ts`（新規） | 鍵の生成・導出・包み・レコードの暗号、復元用のコード |
| `apps/web/src/storage/sync-passkey.ts`（新規） | パスキーの作成・ログインと PRF の取り出し、鍵の開け方 |
| `apps/web/src/storage/sync-engine.ts`（新規） | 受け取る→合わせる→送るの 1 回分と、きっかけ |
| `apps/web/src/state/sync.ts`（新規） | 同期の状態の atom と、エンジンを動かす hook |
| `apps/web/migrations-sync/0001_sync.sql`（新規） | `accounts`・`credentials`・`sessions`・`challenges`・`records`・`usage` |
| `apps/web/src/server/sync-store.ts`（新規） | D1 への読み書き（テストは `node:sqlite`） |
| `apps/web/src/server/sync/sync-auth.ts`（新規） | WebAuthn の検証、セッション、Turnstile |
| `apps/web/src/server/sync/sync-records.ts`（新規） | push / pull / 退会、上限、バージョンの門 |
| `apps/web/src/server/sync/sync.functions.ts`（新規） | `createServerFn` の口、Cookie、`Origin` の確認 |
| `apps/web/src/server/shared/memory-d1.ts`（新規） | `event-store.test.ts` の `memoryD1` を移し、マイグレーションの場所を引数にする |
| `apps/web/src/routes/(plan)/-profile/sync-settings.tsx`（新規） | 「ほかの端末と同期」の節 |
| `apps/web/src/routes/(plan)/-profile/recovery-code-dialog.tsx`（新規） | 復元用のコードを見せる・入れてもらうダイアログ |

---

### Task 1: 注文の行と並び（domain）

**Files:**
- Create: `packages/domain/src/model/stored-plan.ts`, `packages/domain/src/plan-ops/order-positions.ts`
- Test: `packages/domain/src/model/stored-plan.test.ts`, `packages/domain/src/plan-ops/order-positions.test.ts`
- Modify: `packages/domain/src/index.ts`（export を足す）

**Interfaces:**
- Produces:
  - `PlanRowSchema` = `PlanSchema` から `orders` を除いたもの。`type PlanRow`
  - `OrderRowSchema` = `OrderSchema` の各枝に `planId: IdSchema`、`position: v.number()`、`updatedAt: TimestampSchema` を足したもの。`type OrderRow`
  - `orderPositions(previous: ReadonlyMap<string, number>, ids: readonly string[]): Map<string, number>`
  - `splitPlan(plan: Plan, stored: { row?: PlanRow; orders: OrderRow[] }): { row: PlanRow; orders: OrderRow[]; removedOrderIds: string[] }` — 変わった行だけを返す
  - `joinPlan(row: PlanRow, orders: OrderRow[]): Plan` — `position`、同じなら `id` の順に並べ、`updatedAt` は行と注文の一番新しいもの

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("動かした 1 件だけが新しい position になる", () => {
  const previous = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  const next = orderPositions(previous, ["a", "c", "b", "d"]);
  const changed = [...next].filter(([id, p]) => previous.get(id) !== p).map(([id]) => id);
  expect(changed).toHaveLength(1);
  expect(["a", "c", "b", "d"].map((id) => next.get(id))).toEqual(
    [...["a", "c", "b", "d"].map((id) => next.get(id))].sort((x, y) => x! - y!),
  );
});
test("新しい注文は前後の間に入る", () => {
  const next = orderPositions(new Map([["a", 1], ["b", 2]]), ["a", "x", "b"]);
  expect(next.get("x")).toBeGreaterThan(1);
  expect(next.get("x")).toBeLessThan(2);
});
test("中身を変えていない注文と行は返さない", () => {
  const plan = planWith(["o1", "o2"]); // テスト用の組み立て関数
  const first = splitPlan(plan, { orders: [] });
  const again = splitPlan({ ...plan, updatedAt: LATER }, { row: first.row, orders: first.orders });
  expect(again.orders).toEqual([]);
  expect(again.row).toBe(first.row); // 行の updatedAt も変えない
});
test("1 件直すと、その注文だけが plan.updatedAt を持つ", () => { /* o2 の lineItems を変えて splitPlan → orders が o2 の 1 件で updatedAt === LATER */ });
test("配列から消えた注文は removedOrderIds に出る", () => { /* … */ });
test("joinPlan は position の順に並べ、updatedAt は一番新しいもの", () => { /* … */ });
```

- [ ] **Step 2: `pnpm vitest run packages/domain/src/model/stored-plan.test.ts packages/domain/src/plan-ops/order-positions.test.ts` で失敗を確かめる**
- [ ] **Step 3: 実装する**

`orderPositions`: `ids` のうち `previous` にあるものの位置の列から最長増加部分列を取り、そこに入るものは位置をそのままにする。残りは、前に置いた位置と次に残る位置の中間（次がなければ前 + 1、前がなければ次 - 1、どちらもなければ 0）にする。変わったかどうかは `JSON.stringify` で比べる（注文はプレーンな JSON なので、キーの順は `v.parse` を通れば揃う）。

- [ ] **Step 4: テストが通ることを確かめる**
- [ ] **Step 5: コミット** `git commit -m "注文を 1 件ずつの行として持つための形と並びを domain に足す"`

### Task 2: バージョン 11 のマイグレーション

**Files:**
- Create: `packages/domain/src/migrations/v11-order-rows.ts`, `…/v11-order-rows.test.ts`
- Modify: `packages/domain/src/migrations/index.ts`（`CURRENT_SCHEMA_VERSION = 11`、一覧に足す）、`packages/domain/src/migrations/runner.ts`（`StoreName` に `"orders"`）

**Interfaces:**
- Produces: `orderRowsMigration: Migration` = `{ to: 11, stores: { plans: withoutOrders }, seed: { store: "orders", rows } }`

- [ ] **Step 1: 失敗するテストを書く** — 注文 2 件のプランから、`{ ...order, planId, position: 0 | 1, updatedAt: plan.updatedAt }` の 2 行ができ、プランの行から `orders` が消えること。読めない注文（オブジェクトでない）は飛ばし、投げないこと
- [ ] **Step 2: 失敗を確かめる**
- [ ] **Step 3: 実装する**（`v10-spu-months.ts` と同じく、型を信じずに `isRow` で読む）
- [ ] **Step 4: `pnpm vitest run packages/domain` が通ることを確かめる**
- [ ] **Step 5: コミット**

### Task 3: リポジトリ（注文のストア、outbox、消した印）

**Files:**
- Modify: `apps/web/src/storage/repository.ts`, `indexed-db-repository.ts`, `memory-repository.ts`
- Create: `packages/domain/src/sync/records.ts`（+ test）
- Test: `apps/web/src/storage/indexed-db-repository.test.ts`, `memory-repository.test.ts`

**Interfaces:**
- Consumes: Task 1 の `splitPlan` / `joinPlan`、Task 2 の `StoreName`
- Produces（`packages/domain/src/sync/records.ts`）:
  - `type SyncKind = "plan" | "order" | "shop" | "profile" | "spuMonth"`
  - `type SyncRow = { kind: SyncKind; id: string; updatedAt: string; deleted: false; value: unknown } | { kind: SyncKind; id: string; updatedAt: string; deleted: true }`
  - `isNewer(incoming: { updatedAt: string; id: string }, current: { updatedAt: string } | undefined): boolean` — 同じ時刻なら入ってくる方を負けにする（2 台が同じ結果になればよいので、`updatedAt` が同じなら何もしない）
- Produces（`Repository` に足す）:
  ```ts
  sync: {
    /** outbox にあるもの。消した印は deleted: true */
    pending(): Promise<SyncRow[]>;
    /** 送れたもの。送った後にまた書かれたもの（updatedAt が違う）は残す */
    acknowledge(rows: readonly { kind: SyncKind; id: string; updatedAt: string }[]): Promise<void>;
    /** 受け取ったものを、手元より新しいときだけ書く。outbox には入れない。書いたら true */
    apply(rows: readonly SyncRow[]): Promise<boolean>;
    /** 今あるすべてを outbox に入れる（同期を始めたとき、つないだとき） */
    markAllPending(): Promise<void>;
    meta: { get(): Promise<SyncMeta | undefined>; put(meta: SyncMeta | undefined): Promise<void> };
  };
  ```
  `SyncMeta = { accountId: string; cursor: number; encryptionKey: CryptoKey; idKey: CryptoKey }`（`CryptoKey` は `extractable: false` のまま IndexedDB に入る）

- [ ] **Step 1: 失敗するテストを書く**（`fake-indexeddb` を使う既存のテストと同じやり方）
  - `plans.put` → `plans.get` で注文の並びと中身が戻る
  - 1 件の注文を直した `plans.put` の後、`sync.pending()` にその注文とプランの行（行が変わっていれば）だけが入る
  - `plans.delete` で、プランと注文それぞれの `deleted: true` が `pending()` に出て、`plans.list()` から消える
  - `apply` で、手元より古い行は書かれず、新しい行は書かれ、`pending()` は増えない
  - 親のプランがない注文は `plans.list()` に出ない
  - `put` 中にトランザクションが失敗したら、行も outbox も書かれない
  - バージョン 10 のデータベースを開くと、注文が `orders` に移っている（既存のマイグレーションのテストに足す）
- [ ] **Step 2: 失敗を確かめる** `pnpm vitest run apps/web/src/storage`
- [ ] **Step 3: 実装する**
  - ストア: `orders`（keyPath `id`、index `planId`）、`outbox`（key `kind:id`、値 `{ kind, id, updatedAt }`）、`tombstones`（key `kind:id`、値 `{ kind, id, updatedAt }`）、`syncMeta`（1 行）
  - `plans.put` は `plans`・`orders`・`outbox`・`tombstones` を 1 つのトランザクションで書く。シェア・プロフィール・SPU の `put` も outbox に入れる
  - outbox に入れるのは、`syncMeta` があるときだけにしない（いつも入れる）。同期していない人でも数が増えるだけで、`markAllPending` と同じものになる
  - `clear()` は `syncMeta` を残し、すべての行の `deleted: true` を outbox に入れる（初期化が同期先にも伝わる）。同期をやめるときは `sync.meta.put(undefined)` と outbox を空にする
  - クォランティンの `StoreName` に `orders` を足す
- [ ] **Step 4: テストが通ることを確かめる**。`pnpm vitest run` 全体と `pnpm type:check` も
- [ ] **Step 5: コミット**

### Task 4: 端末での暗号

**Files:**
- Create: `apps/web/src/storage/sync-crypto.ts`, `sync-crypto.test.ts`

**Interfaces:**
- Produces:
  - `generateMasterSecret(): Uint8Array`（32 バイト）
  - `deriveKeys(master: Uint8Array): Promise<{ encryptionKey: CryptoKey; idKey: CryptoKey }>` — HKDF-SHA256、info `point-sprint sync encryption v1` / `point-sprint sync id v1`。どちらも `extractable: false`
  - `wrapSecret(master: Uint8Array, keyMaterial: Uint8Array, info: "prf" | "recovery"): Promise<string>` / `unwrapSecret(wrapped: string, keyMaterial: Uint8Array, info): Promise<Uint8Array | undefined>` — AES-GCM。解けなければ `undefined`（投げない）
  - `recordId(idKey: CryptoKey, kind: SyncKind, id: string): Promise<string>` — HMAC-SHA256 の base64url
  - `encryptRow(keys, row: SyncRow, version: number): Promise<{ recordId: string; updatedAt: string; version: number; deleted: boolean; body: string }>` — 平文は `{ kind, id, value? }` の JSON。AAD は `recordId|version|updatedAt|deleted`
  - `decryptRecord(keys, record): Promise<SyncRow & { version: number }>` — AAD が合わなければ投げる
  - `generateRecoveryCode(): string`、`parseRecoveryCode(input: string): Uint8Array | undefined`（大文字小文字・空白・`-`・`O`/`0`・`I`/`L`/`1` の揺れを許す）
  - `recoveryVerifier(code: Uint8Array): Promise<string>` — HKDF info `point-sprint sync recovery login v1` の 32 バイトの SHA-256 を base64url。サーバーに送るのはこれだけ
  - `PRF_SALT: Uint8Array` = `SHA-256("point-sprint sync prf v1")`（定数として書く）
- [ ] **Step 1: 失敗するテストを書く**: 包んで解くと元に戻る / 違う鍵では `undefined` / AAD の `updatedAt` を書き換えると `decryptRecord` が投げる / 同じ `kind`・`id` から同じ `recordId` / 復元用のコードは 26 文字 + 区切りで、揺れた入力も同じバイトに戻る / 1 文字違いは `undefined` ではなく別のバイト（チェックサムは付けない。解けないことで分かる）
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**（Node の WebCrypto で動く）
- [ ] **Step 5: コミット**

### Task 5: 同期の D1 と設定

**Files:**
- Create: `apps/web/migrations-sync/0001_sync.sql`, `apps/web/src/server/shared/memory-d1.ts`
- Modify: `apps/web/cloudflare.config.ts`, `apps/web/src/server/shared/cloudflare.d.ts`, `apps/web/src/server/shared/dev-migrations.worker.ts`, `apps/web/scripts/migrate-events-db.ts`（→ 両方のデータベースを扱う。名前は変えず、`--sync` を足すのではなく、いつも両方を当てる）, `apps/web/package.json`, `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`, `apps/web/src/server/official-events/event-store.test.ts`（`memoryD1` を移したものを使う）

- [ ] **Step 1: スキーマを書く**

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  recovery_verifier TEXT NOT NULL UNIQUE,
  recovery_wrap TEXT NOT NULL
);
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  prf_wrap TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE challenges (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, purpose TEXT NOT NULL, account_id TEXT, expires_at TEXT NOT NULL);
CREATE TABLE records (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  deleted INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (account_id, record_id)
);
CREATE INDEX records_by_seq ON records(account_id, seq);
CREATE TABLE usage (account_id TEXT NOT NULL, hour TEXT NOT NULL, writes INTEGER NOT NULL, PRIMARY KEY (account_id, hour));
```

- [ ] **Step 2: 設定を足す** — `SYNC_DB` と `PREVIEW_SYNC_DB` を `EVENTS_DB` と同じ形で書き、`bindings.d1(...)` に足す。`cf d1 migrations apply <id> --dir migrations-sync` で当てる
- [ ] **Step 3: 利用者に確かめてから D1 を作る** — `pnpm exec cf d1 create point-sprint-sync` と `point-sprint-sync-preview` は Cloudflare のアカウントに作るので、実行前に聞く。作った ID を設定に書く
- [ ] **Step 4: `memoryD1(migrationsDir: URL)` を移し、`event-store.test.ts` がそれを使っても通ることを確かめる** `pnpm vitest run apps/web/src/server`
- [ ] **Step 5: `pnpm dev` で両方のローカル D1 ができることを確かめる**
- [ ] **Step 6: コミット**

### Task 6: サーバーの認証（パスキー、セッション、Turnstile）

**Files:**
- Create: `apps/web/src/server/sync-store.ts`, `apps/web/src/server/sync/sync-auth.ts`, `sync-auth.test.ts`
- Modify: `apps/web/package.json`（`@simplewebauthn/server@14.0.3`）

**Interfaces:**
- Consumes: Task 5 の `memoryD1`、`verifyTurnstile`（`src/server/shared/turnstile.ts`）
- Produces（すべて `deps: { db: D1Database; now: () => Date; rpID: string; origin: string; verifyToken: (token: string) => Promise<TurnstileResult>; verifyRegistration?, verifyAuthentication? }` を受ける。検証関数はテストで差し替える）:
  - `registrationOptions(deps, { turnstileToken } | { accountId }): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>` — 新しく始めるときは Turnstile を通す。パスキーを足すとき（復元用のコードでログインした後）は `accountId` を使い、Turnstile は通さない。`user.name` は `ポイントスプリント`、`residentKey: "required"`、`userVerification: "required"`、`extensions: { prf: {} }`
  - `register(deps, { challengeId, response, recoveryVerifier, recoveryWrap, prfWrap? }): Promise<{ accountId: string; sessionToken: string }>`
  - `authenticationOptions(deps): Promise<{ challengeId; options }>` — `allowCredentials` は空（パスキーを選んでもらう）
  - `authenticate(deps, { challengeId, response }): Promise<{ accountId; sessionToken; prfWrap?: string; recoveryWrap: string }>`
  - `loginWithRecovery(deps, { verifier }): Promise<{ accountId; sessionToken; recoveryWrap } | undefined>`
  - `setPrfWrap(deps, accountId, credentialId, prfWrap): Promise<void>` — すでに包みがある credential には書かない（Review Focus 4）
  - `sessionAccount(deps, token): Promise<string | undefined>`
  - セッションは 32 バイトの乱数。D1 には SHA-256 だけを置く。期限は 400 日で、使うたびに延ばす
  - チャレンジは 5 分で切れ、1 回使ったら消す
- [ ] **Step 1: 失敗するテストを書く**: Turnstile が断ったらアカウントを作らない / 期限切れ・使い済みのチャレンジは断る / 登録したパスキーでログインすると同じ `accountId` / 復元用の検証値で同じアカウントに入れる、違う値では入れない / `setPrfWrap` は既存の包みを上書きしない / セッションの期限が切れたら `undefined`
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**
- [ ] **Step 5: コミット**

### Task 7: サーバーのレコード（送る・受け取る・やめる）

**Files:**
- Create: `apps/web/src/server/sync/sync-records.ts`, `sync-records.test.ts`

**Interfaces:**
- Produces:
  - `type RemoteRecord = { recordId: string; updatedAt: string; version: number; deleted: boolean; body: string }`
  - `push(deps, accountId, records: RemoteRecord[]): Promise<{ ok: true; seq: number } | { ok: false; reason: "outdated" | "too-large" | "quota" | "rate" | "future" }>` — 1 回 500 件まで。`updated_at` が保存済み以上のものだけ書く（あと勝ち）。書いた行に `seq` を振る
  - `pull(deps, accountId, since: number): Promise<{ records: (RemoteRecord & { seq: number })[]; seq: number; more: boolean }>` — 1 回 500 件
  - `deleteAccount(deps, accountId): Promise<void>` — アカウント、パスキー、セッション、レコードをすべて消す
  - 上限: `body` 64KB、アカウントの合計 10MB、1 時間に 600 件の書き込み、`updatedAt` がサーバーの時刻より 1 日以上先なら `future`
- [ ] **Step 1: 失敗するテストを書く**: 古い `updatedAt` は上書きしない / `pull(since)` は後から書いたものだけ返す / 古い `version` は `outdated`（アカウントの `schema_version` を上げるのは新しい方の push）/ 上限ごとの理由 / `deleteAccount` の後は何も残らない
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**
- [ ] **Step 5: コミット**

### Task 8: サーバー関数の口

**Files:**
- Create: `apps/web/src/server/sync/sync.functions.ts`（`submit-inquiry.ts` と同じく、Workers に依存するものは handler の中で import）

**Interfaces:**
- Produces（`createServerFn({ method: "POST" })`）: `syncRegistrationOptions`、`syncRegister`、`syncAuthenticationOptions`、`syncAuthenticate`、`syncRecoveryLogin`、`syncSetPrfWrap`、`syncPush`、`syncPull`、`syncDeleteAccount`
  - セッションは Cookie `__Host-sync`（`HttpOnly; Secure; SameSite=Strict; Path=/`）。ローカル（`http://localhost`）は `Secure` なしの `sync`
  - すべての関数で `Origin` がサイトのものでなければ断る
  - `rpID` と `origin` はリクエストのホストから作る（Preview の workers.dev でも動く）
  - 受け取る値は valibot で確かめる。`response.clientExtensionResults.prf` があれば断る（PRF の出力が送られてきていないことを確かめる）
- [ ] **Step 1: `pnpm type:check` と `pnpm vitest run apps/web/src/server` が通ることを確かめる**（中身は Task 6・7 で試してある）
- [ ] **Step 2: コミット**

### Task 9: 端末でのパスキーと鍵の開け方

**Files:**
- Create: `apps/web/src/storage/sync-passkey.ts`, `sync-passkey.test.ts`
- Modify: `apps/web/package.json`（`@simplewebauthn/browser`）

**Interfaces:**
- Consumes: Task 4、Task 8
- Produces:
  - `startSync(turnstileToken: string): Promise<{ recoveryCode: string }>` — パスキーを作る → `create` で PRF の値が返らなければ、そのパスキーで `get` してもう一度取りに行く → 鍵を作り、PRF の包み（取れたときだけ）と復元用の包みと検証値を送る → `syncMeta` を書き、`markAllPending()`
  - `signIn(): Promise<{ status: "unlocked" } | { status: "needs-recovery-code"; recoveryWrap: string }>` — PRF の包みを PRF の値で解く。解けない・PRF がない・包みがないときは、復元用のコードを聞く
  - `unlockWithRecoveryCode(code: string, recoveryWrap: string, prf?: { credentialId: string; output: Uint8Array }): Promise<boolean>` — 解けたら `syncMeta` を書き、`markAllPending()`。この credential に包みがまだなく PRF の値があるときだけ `syncSetPrfWrap` を呼ぶ
  - `recoverWithCode(code: string): Promise<boolean>` — パスキーをなくした人向け。検証値でログイン → 新しいパスキーを作って PRF の包みを足す
  - `stopSync(): Promise<void>` — `syncDeleteAccount` → `syncMeta` を消す。対応するブラウザでは `PublicKeyCredential.signalUnknownCredential` でパスキーの削除を促す（なければ何もしない）
  - WebAuthn の呼び出し（`navigator.credentials` と simplewebauthn）は引数で差し替えられるようにし、テストでは PRF の値を固定で返す偽物を使う
- [ ] **Step 1: 失敗するテストを書く**: PRF が返る端末では復元用のコードを聞かない / PRF の値がずれた端末では `needs-recovery-code` になり、正しいコードで開ける / ずれた端末が包みを書き直さない（`syncSetPrfWrap` が呼ばれない）/ サーバーに送る値に PRF の出力・鍵・コードが含まれない（偽の server 関数に渡ったものを JSON にして、それぞれのバイト列の base64url が含まれないこと）
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**
- [ ] **Step 5: コミット**

### Task 10: 同期エンジンときっかけ

**Files:**
- Create: `apps/web/src/storage/sync-engine.ts`, `sync-engine.test.ts`, `apps/web/src/state/sync.ts`
- Modify: `apps/web/src/app-providers.tsx`（エンジンを動かし、受け取ったら `client.invalidateQueries()`、`outdated` のときは既存のダイアログを出す）

**Interfaces:**
- Produces:
  - `syncOnce(deps: { repository; push; pull; version: number }): Promise<{ status: "synced"; received: boolean } | { status: "outdated" } | { status: "signed-out" } | { status: "failed"; reason: string }>` — 受け取る（`more` がなくなるまで）→ 解いて `migrateRow` → `apply` → カーソルを進める → `pending()` を暗号にして送る → `acknowledge`
  - 自分のバージョンより新しいレコードを受け取ったら、`apply` せずに `outdated`
  - `syncStatusAtom`: `"off" | "idle" | "syncing" | "offline" | "error" | "outdated"` と最後に終わった時刻
  - `useSyncTriggers()`: 開いたとき・書いてから 2 秒後（`mutationCache` を見る）・`visibilitychange` で前に出たとき・`online`。同時に 2 回は走らせない（`use-single-flight.ts` を使う）
- [ ] **Step 1: 失敗するテストを書く**（2 つのメモリのリポジトリと 1 つの偽のサーバーで）: A で足した注文と B で直した別の注文が、両方に残る / 同じ注文を両方で直すと、あとの方が両方に残る / A で消したプランが B から戻ってこない / 新しいバージョンのレコードを受け取ると `outdated` で、何も書かない / 送れなかったものは outbox に残り、次に送られる
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**
- [ ] **Step 5: コミット**

### Task 11: 画面（プロフィールの「ほかの端末と同期」）

**Files:**
- Create: `apps/web/src/routes/(plan)/-profile/sync-settings.tsx`, `recovery-code-dialog.tsx`, `sync-settings.browser.test.tsx`
- Modify: `apps/web/src/routes/(plan)/-profile/profile.tsx`（`AccountSettings` の前に置く）

画面の状態と言葉（言葉は確かめてもらうときに直す）:

| 状態 | 出すもの |
| --- | --- |
| 同期していない | 見出し「ほかの端末と同期」。説明「パスキーでログインすると、PC とスマホで同じプランと注文を使えます。データは端末の中で暗号にしてから送るので、運営者も読めません。」ボタン「パスキーで同期を始める」（Turnstile のあと）と「ほかの端末で始めた同期にログイン」。小さく「パスキーをなくした方は 復元用のコードで戻す」 |
| 始めた直後 | ダイアログ「復元用のコードを控えてください」。コード（`Code`）、「コピー」（`useClipboard`）、説明「パスキーで開けない端末や、パスキーをなくしたときに使います。運営者はこのコードを持っていないので、なくすと戻せません。」、チェック「控えました」を付けるまで「閉じる」は押せない |
| ログインしたが開けない | ダイアログ「復元用のコードを入れてください」。`Input`、「開く」。違ったら「コードが違います」 |
| 同期中 | `Status` で「同期しています」/「同期しました（HH:mm）」/「つながっていません。つながったら送ります」/「同期できませんでした」 |
| 同期している | 「同期をやめる」→ 確認「サーバーにあるデータを消して、同期をやめます。この端末のデータは残ります。ほかの端末のデータも残りますが、もう同期されません。」 |
| PRF が使えない端末で始めた | 始めたあとに「この端末では、ほかの端末でログインするときに復元用のコードが要ります」と 1 行添える |

- [ ] **Step 1: 失敗するテストを書く**（ブラウザのテスト。`sync-passkey` の関数は差し替える）: 「控えました」にチェックするまで閉じられない / 開けないときにコードを聞き、違うコードでは「コードが違います」/ 「同期をやめる」の確認で `stopSync` が呼ばれる
- [ ] **Step 2〜4: 失敗を確かめ、実装し、通す**
- [ ] **Step 5: `pnpm dev` で画面を出し、利用者に見てもらう**。見た目で直し方が 1 つに決まらないところは、Artifact で案を並べてから決める。PC とスマホの幅は分けて確かめる
- [ ] **Step 6: コミット**

### Task 12: 計測と文書

**Files:**
- Modify: `apps/web/src/markdown/privacy.md`（「当サイトに保存される情報」「外部送信の一覧」に同期を足す。送るもの、送らないもの、やめ方）、`apps/web/src/markdown/terms.md`（「免責事項」に、パスキーと復元用のコードの両方をなくしたらデータは戻らないこと）、`apps/web/src/routes/(plan)/-profile/sync-settings.tsx`
- Create: なし（`window.gtag` があれば送るだけの小さな関数を `sync-settings.tsx` に置く）

- [ ] **Step 1: GA のイベントを送る** — `sync_start_click` / `sync_start_done` / `sync_login_click` / `sync_login_done` / `sync_recovery_code_needed`。中身（ID や件数）は送らない。Issue で決めた「途中でやめた人の数」はこの差で見る
- [ ] **Step 2: プライバシーポリシーと利用規約を書き足し、改定日を更新する**
- [ ] **Step 3: `pnpm check:all` が通ることを確かめる**
- [ ] **Step 4: コミット**

### Task 13: E2E（2 台で同期する）

**Files:**
- Create: `apps/web/e2e/sync.spec.ts`, `apps/web/e2e/pages/sync-section.ts`
- Modify: `apps/web/e2e/pages/index.ts`, `apps/web/playwright.config.ts`（E2E では Turnstile のテスト用の鍵 `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` を使う）

- [ ] **Step 1: テストを書く** — 2 つの browser context それぞれに CDP の `WebAuthn.addVirtualAuthenticator`（`protocol: "ctap2"`、`transport: "internal"`、`hasResidentKey`、`hasUserVerification`、`isUserVerified`、`hasPrf: true`）を付ける。A で同期を始めて注文を足し、A の認証器の credential（`WebAuthn.getCredentials`）を B に入れ（`WebAuthn.addCredential`）、B でログインすると注文が見える。B で別の注文を足すと A に出る
- [ ] **Step 2: PRF のない認証器（`hasPrf: false`）の B では、復元用のコードを聞かれ、入れると開けることも書く**
- [ ] **Step 3: `pnpm test:e2e` が通ることを確かめる**（ポート 4173 がほかの worktree と使い合いになっていたら、空くのを待つ）
- [ ] **Step 4: コミット**

### Task 14: 確かめてもらう

- [ ] **Step 1: `pnpm check:all` と `pnpm test:e2e` が通ることを確かめる**
- [ ] **Step 2: 実機で確かめる手順を利用者に渡す** — iPhone の Safari だけで始める / Mac の Safari でログイン / Windows か Mac の Chrome で QR を読んでログイン（ここで復元用のコードを聞かれるかを記録する）
- [ ] **Step 3: 利用者が画面とコードを確かめてから、PR を作る**（本文は `.github/pull_request_template.md` の節で。レビュー観点に `[プロフィール](/profile)` を添え、Preview ではパスキーが workers.dev のドメインのものになると書く）
