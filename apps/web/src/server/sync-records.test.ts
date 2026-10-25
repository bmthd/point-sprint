import { describe, expect, test } from "vitest";
import { memoryD1 } from "./memory-d1";
import { type RemoteRecord, LIMITS, deleteAccount, pull, push } from "./sync-records";

const ACCOUNT = "account-1";
const now = new Date("2026-10-25T00:00:00.000Z");

function setUp() {
  const { db, sqlite } = memoryD1(new URL("../../migrations-sync/", import.meta.url));
  sqlite
    .prepare(
      "INSERT INTO accounts (id, created_at, schema_version, recovery_verifier, recovery_wrap) VALUES (?, ?, 0, 'v', 'w')",
    )
    .run(ACCOUNT, now.toISOString());
  return { deps: { db, now: () => now }, sqlite };
}

const record = (
  id: string,
  updatedAt: string,
  body = `body of ${id}`,
  version = 11,
): RemoteRecord => ({
  recordId: id,
  updatedAt,
  version,
  deleted: false,
  body,
});

describe("push and pull", () => {
  test("a pull returns what was pushed after where it starts", async () => {
    const { deps } = setUp();
    await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z")]);
    const first = await pull(deps, ACCOUNT, 0);
    expect(first.records.map((r) => r.recordId)).toEqual(["a"]);
    await push(deps, ACCOUNT, [record("b", "2026-10-24T00:00:00.000Z")]);
    const next = await pull(deps, ACCOUNT, first.seq);
    expect(next.records.map((r) => r.recordId)).toEqual(["b"]);
    expect(next.more).toBe(false);
  });

  test("an older row does not replace a newer one", async () => {
    const { deps } = setUp();
    await push(deps, ACCOUNT, [record("a", "2026-10-24T12:00:00.000Z", "newer")]);
    await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z", "older")]);
    const { records } = await pull(deps, ACCOUNT, 0);
    expect(records.map((r) => r.body)).toEqual(["newer"]);
  });

  test("a newer row replaces the older one and is pulled again", async () => {
    const { deps } = setUp();
    await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z", "older")]);
    const { seq } = await pull(deps, ACCOUNT, 0);
    await push(deps, ACCOUNT, [record("a", "2026-10-24T12:00:00.000Z", "newer")]);
    expect((await pull(deps, ACCOUNT, seq)).records.map((r) => r.body)).toEqual(["newer"]);
  });

  test("an app older than the account's rows may not write", async () => {
    const { deps } = setUp();
    await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z", "x", 12)]);
    expect(await push(deps, ACCOUNT, [record("b", "2026-10-24T00:00:00.000Z", "x", 11)])).toEqual({
      ok: false,
      reason: "outdated",
    });
  });

  test("a row dated more than a day ahead is refused", async () => {
    const { deps } = setUp();
    expect(await push(deps, ACCOUNT, [record("a", "2026-10-26T00:00:01.000Z")])).toEqual({
      ok: false,
      reason: "future",
    });
  });

  test("more records than a push takes are refused", async () => {
    const { deps } = setUp();
    const many = Array.from({ length: LIMITS.push + 1 }, (_, i) =>
      record(`r${i}`, "2026-10-24T00:00:00.000Z"),
    );
    expect(await push(deps, ACCOUNT, many)).toEqual({ ok: false, reason: "too-large" });
  });

  test("too large a row, too much data or too many writes are refused", async () => {
    const { deps, sqlite } = setUp();
    expect(
      await push(deps, ACCOUNT, [
        record("a", "2026-10-24T00:00:00.000Z", "x".repeat(LIMITS.body + 1)),
      ]),
    ).toEqual({ ok: false, reason: "too-large" });

    sqlite.prepare("UPDATE accounts SET bytes = ?").run(LIMITS.account - 5);
    expect(await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z", "123456")])).toEqual({
      ok: false,
      reason: "quota",
    });
    sqlite.prepare("UPDATE accounts SET bytes = 0").run();

    sqlite
      .prepare("INSERT INTO usage (account_id, hour, writes) VALUES (?, ?, ?)")
      .run(ACCOUNT, now.toISOString().slice(0, 13), LIMITS.writesPerHour);
    expect(await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z")])).toEqual({
      ok: false,
      reason: "rate",
    });
  });

  test("a pull of more than a batch says more are waiting", async () => {
    const { deps } = setUp();
    for (let start = 0; start < LIMITS.pull; start += LIMITS.push) {
      const many = Array.from({ length: Math.min(LIMITS.push, LIMITS.pull - start) }, (_, i) =>
        record(`r${start + i}`, "2026-10-24T00:00:00.000Z"),
      );
      expect(await push(deps, ACCOUNT, many)).toEqual({ ok: true });
    }
    await push(deps, ACCOUNT, [record("last", "2026-10-24T00:00:00.000Z")]);
    const first = await pull(deps, ACCOUNT, 0);
    expect(first.records).toHaveLength(LIMITS.pull);
    expect(first.more).toBe(true);
    expect((await pull(deps, ACCOUNT, first.seq)).records.map((r) => r.recordId)).toEqual(["last"]);
  });
});

describe("deleteAccount", () => {
  test("leaves nothing of the account", async () => {
    const { deps, sqlite } = setUp();
    await push(deps, ACCOUNT, [record("a", "2026-10-24T00:00:00.000Z")]);
    await deleteAccount(deps, ACCOUNT);
    for (const table of ["accounts", "records", "usage"]) {
      expect(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(0);
    }
  });
});
