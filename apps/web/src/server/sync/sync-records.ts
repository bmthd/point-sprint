import type { D1Database, D1PreparedStatement } from "cloudflare:workers";

// The sealed rows of an account. The later `updatedAt` wins row by row; every row written gets the
// account's next sequence number, which the devices read from.
//
// A Worker on the Free plan makes at most 50 queries per request, and each statement of a batch
// counts: a push writes few records, one statement each.

export type RemoteRecord = {
  recordId: string;
  updatedAt: string;
  version: number;
  deleted: boolean;
  body: string;
};

export type SyncRecordsDeps = { db: D1Database; now?: () => Date };

export const LIMITS = {
  /** Records in one push. */
  push: 30,
  /** Records in one pull. */
  pull: 500,
  /** Characters of one record's body. */
  body: 64 * 1024,
  /** Characters of every body of an account. */
  account: 10 * 1024 * 1024,
  /** Records written per account and hour: enough for a first push of a year's data. */
  writesPerHour: 2000,
  /** How far ahead of the server's clock a row's `updatedAt` may be. */
  futureMs: 24 * 60 * 60 * 1000,
};

export type PushResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        /** A newer app wrote the account's rows: this one must reload first. */
        "outdated" | "too-large" | "quota" | "rate" | "future" | "no-account";
    };

/** Writes the records that are newer than the ones kept, all or none. */
export async function push(
  deps: SyncRecordsDeps,
  accountId: string,
  records: readonly RemoteRecord[],
): Promise<PushResult> {
  const { db } = deps;
  const now = deps.now?.() ?? new Date();
  if (records.length > LIMITS.push || records.some((r) => r.body.length > LIMITS.body)) {
    return { ok: false, reason: "too-large" };
  }
  const limit = new Date(now.getTime() + LIMITS.futureMs).toISOString();
  if (records.some((record) => record.updatedAt > limit)) return { ok: false, reason: "future" };

  const account = await db
    .prepare("SELECT schema_version, bytes FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ schema_version: number; bytes: number }>();
  if (!account) return { ok: false, reason: "no-account" };
  if (records.some((record) => record.version < account.schema_version)) {
    return { ok: false, reason: "outdated" };
  }
  if (records.length === 0) return { ok: true };

  const hour = now.toISOString().slice(0, 13);
  const used = await db
    .prepare("SELECT writes FROM usage WHERE account_id = ? AND hour = ?")
    .bind(accountId, hour)
    .first<{ writes: number }>();
  if ((used?.writes ?? 0) + records.length > LIMITS.writesPerHour) {
    return { ok: false, reason: "rate" };
  }

  const { results } = await db
    .prepare(
      `SELECT record_id, length(body) AS size FROM records WHERE account_id = ? AND record_id IN (${records.map(() => "?").join(", ")})`,
    )
    .bind(accountId, ...records.map((record) => record.recordId))
    .all<{ record_id: string; size: number }>();
  const kept = new Map(results.map(({ record_id, size }) => [record_id, size]));
  const growth = records.reduce(
    (sum, record) => sum + record.body.length - (kept.get(record.recordId) ?? 0),
    0,
  );
  if (account.bytes + growth > LIMITS.account) return { ok: false, reason: "quota" };

  const writes: D1PreparedStatement[] = records.map((record) =>
    // In the same statement, so that two pushes at once cannot both get through:
    // - a row of an older data version than the account's is not written;
    // - a row is replaced only by one as late or later. Of two rows of the same time, the last
    //   written stays, and the devices take it (`wins` in the domain).
    // A batch is one transaction, so the sequence numbers are given in order.
    db
      .prepare(
        `INSERT INTO records (account_id, record_id, seq, updated_at, schema_version, deleted, body)
         SELECT ?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM records WHERE account_id = ?), ?, ?, ?, ?
         WHERE ? >= (SELECT schema_version FROM accounts WHERE id = ?)
         ON CONFLICT (account_id, record_id) DO UPDATE SET
           seq = excluded.seq, updated_at = excluded.updated_at,
           schema_version = excluded.schema_version, deleted = excluded.deleted, body = excluded.body
         WHERE excluded.updated_at >= records.updated_at`,
      )
      .bind(
        accountId,
        record.recordId,
        accountId,
        record.updatedAt,
        record.version,
        record.deleted ? 1 : 0,
        record.body,
        record.version,
        accountId,
      ),
  );
  const newest = Math.max(...records.map((record) => record.version));
  await db.batch([
    ...writes,
    db
      .prepare(
        "UPDATE accounts SET schema_version = max(schema_version, ?), bytes = (SELECT coalesce(sum(length(body)), 0) FROM records WHERE account_id = ?) WHERE id = ?",
      )
      .bind(newest, accountId, accountId),
    db
      .prepare(
        "INSERT INTO usage (account_id, hour, writes) VALUES (?, ?, ?) ON CONFLICT (account_id, hour) DO UPDATE SET writes = writes + excluded.writes",
      )
      .bind(accountId, hour, records.length),
    db.prepare("DELETE FROM usage WHERE account_id = ? AND hour < ?").bind(accountId, hour),
  ]);
  // A newer app wrote between the check above and the batch: its rows were kept, these were not.
  const after = await db
    .prepare("SELECT schema_version FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<{ schema_version: number }>();
  if ((after?.schema_version ?? 0) > newest) return { ok: false, reason: "outdated" };
  return { ok: true };
}

export type PullResult = {
  records: (RemoteRecord & { seq: number })[];
  /** Where the next pull starts. */
  seq: number;
  /** Whether more records are waiting after these. */
  more: boolean;
};

/** The records written after `since`, oldest first. */
export async function pull(
  deps: SyncRecordsDeps,
  accountId: string,
  since: number,
): Promise<PullResult> {
  const { results } = await deps.db
    .prepare(
      "SELECT record_id, seq, updated_at, schema_version, deleted, body FROM records WHERE account_id = ? AND seq > ? ORDER BY seq LIMIT ?",
    )
    .bind(accountId, since, LIMITS.pull + 1)
    .all<{
      record_id: string;
      seq: number;
      updated_at: string;
      schema_version: number;
      deleted: number;
      body: string;
    }>();
  const records = results.slice(0, LIMITS.pull).map((row) => ({
    recordId: row.record_id,
    seq: row.seq,
    updatedAt: row.updated_at,
    version: row.schema_version,
    deleted: row.deleted === 1,
    body: row.body,
  }));
  return {
    records,
    seq: records.at(-1)?.seq ?? since,
    more: results.length > LIMITS.pull,
  };
}

/** Removes the account and everything kept for it: its passkeys, sessions and records. */
export async function deleteAccount(deps: SyncRecordsDeps, accountId: string): Promise<void> {
  const { db } = deps;
  await db.batch(
    ["records", "usage", "sessions", "credentials", "challenges"]
      .map((table) => db.prepare(`DELETE FROM ${table} WHERE account_id = ?`).bind(accountId))
      .concat(db.prepare("DELETE FROM accounts WHERE id = ?").bind(accountId)),
  );
}
