import type { SyncRow } from "@workspaces/domain";
import { describe, expect, test } from "vitest";
import {
  decryptRecord,
  deriveKeys,
  encryptRow,
  generateMasterSecret,
  generateRecoveryCode,
  parseRecoveryCode,
  recordId,
  recoveryVerifier,
  unwrapSecret,
  wrapSecret,
} from "./sync-crypto";

const row: SyncRow = {
  kind: "shop",
  id: "00000000-0000-4000-8000-000000000002",
  updatedAt: "2026-10-05T00:00:00.000Z",
  deleted: false,
  value: { id: "00000000-0000-4000-8000-000000000002", name: "ショップA" },
};

describe("wrapping the secret", () => {
  test("unwraps with the same key material and not with another", async () => {
    const master = generateMasterSecret();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapSecret(master, prf, "prf");
    expect(await unwrapSecret(wrapped, prf, "prf")).toEqual(master);
    expect(await unwrapSecret(wrapped, crypto.getRandomValues(new Uint8Array(32)), "prf")).toBe(
      undefined,
    );
    expect(await unwrapSecret(wrapped, prf, "recovery")).toBeUndefined();
  });
});

describe("records", () => {
  test("a row comes back from its record", async () => {
    const keys = await deriveKeys(generateMasterSecret());
    const record = await encryptRow(keys, row, 11);
    expect(record).toMatchObject({ updatedAt: row.updatedAt, version: 11, deleted: false });
    expect(record.body).not.toContain("ショップ");
    expect(await decryptRecord(keys, record)).toEqual({ row, version: 11 });
  });

  test("the same row has the same id, which is not its own", async () => {
    const keys = await deriveKeys(generateMasterSecret());
    const id = await recordId(keys.idKey, "shop", row.id);
    expect(id).toBe(await recordId(keys.idKey, "shop", row.id));
    expect(id).not.toContain(row.id);
  });

  test("a changed header or a body from another record is refused", async () => {
    const keys = await deriveKeys(generateMasterSecret());
    const record = await encryptRow(keys, row, 11);
    await expect(
      decryptRecord(keys, { ...record, updatedAt: "2026-10-09T00:00:00.000Z" }),
    ).rejects.toThrow();
    const other = await encryptRow(
      keys,
      { ...row, id: "00000000-0000-4000-8000-000000000003" },
      11,
    );
    await expect(decryptRecord(keys, { ...other, body: record.body })).rejects.toThrow();
  });

  test("other keys cannot open a record", async () => {
    const record = await encryptRow(await deriveKeys(generateMasterSecret()), row, 11);
    await expect(decryptRecord(await deriveKeys(generateMasterSecret()), record)).rejects.toThrow();
  });

  test("a removal keeps no value", async () => {
    const keys = await deriveKeys(generateMasterSecret());
    const removed: SyncRow = { kind: "shop", id: row.id, updatedAt: row.updatedAt, deleted: true };
    expect((await decryptRecord(keys, await encryptRow(keys, removed, 11))).row).toEqual(removed);
  });
});

describe("recovery code", () => {
  test("is 26 characters in groups of 4", () => {
    // cspell:disable-next-line
    expect(generateRecoveryCode()).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/);
  });

  test("reads back as typed in any case, with spaces and look-alike letters", () => {
    const code = generateRecoveryCode();
    const bytes = parseRecoveryCode(code);
    expect(bytes).toHaveLength(16);
    const typed = ` ${code.toLowerCase().replaceAll("-", " ").replaceAll("0", "o").replaceAll("1", "l")} `;
    expect(parseRecoveryCode(typed)).toEqual(bytes);
  });

  test("a code of the wrong length or with other characters is not read", () => {
    expect(parseRecoveryCode("ABCD")).toBeUndefined();
    expect(parseRecoveryCode("U".repeat(26))).toBeUndefined();
  });

  test("the verifier is the same for the same code and tells nothing of it", async () => {
    const bytes = parseRecoveryCode(generateRecoveryCode())!;
    const verifier = await recoveryVerifier(bytes);
    expect(await recoveryVerifier(bytes)).toBe(verifier);
    expect(verifier).not.toBe(await recoveryVerifier(parseRecoveryCode(generateRecoveryCode())!));
  });
});
