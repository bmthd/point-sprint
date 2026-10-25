import { describe, expect, test } from "vitest";
import { createMemoryRepository } from "./memory-repository";
import { toBase64Url, parseRecoveryCode } from "./sync-crypto";
import {
  SyncError,
  recoverWithCode,
  reissueRecoveryCode,
  signIn,
  startSync,
  stopSync,
  unlockWithRecoveryCode,
} from "./sync-passkey";
import { createTestBackend, createTestPasskeys, prfOutput } from "./sync-test-server";

function setUp({ turnstile = true } = {}) {
  const backend = createTestBackend({ turnstile });
  const passkeys = createTestPasskeys();
  const device = (prf: (id: string) => Uint8Array | undefined) => {
    const { server, sent } = backend.device();
    return { server, sent, passkeys: passkeys.device(prf), repository: createMemoryRepository() };
  };
  return { device };
}

const samePrf = (id: string) => prfOutput(id);
const otherPrf = (id: string) => prfOutput(id, "other-");
const noPrf = () => undefined;

describe("starting to sync", () => {
  test("keeps the keys on the device and marks the data to send", async () => {
    const phone = setUp().device(samePrf);
    await phone.repository.profile.put({ updatedAt: "2026-10-25T00:00:00.000Z" });
    await phone.repository.sync.acknowledge(await phone.repository.sync.pending());

    const started = await startSync(phone, "token");
    expect(started.prf).toBe(true);
    expect(parseRecoveryCode(started.recoveryCode)).toBeDefined();
    expect((await phone.repository.sync.meta.get())?.cursor).toBe(0);
    expect(await phone.repository.sync.pending()).toHaveLength(1);
  });

  test("stops when Turnstile refuses", async () => {
    const phone = setUp({ turnstile: false }).device(samePrf);
    await expect(startSync(phone, "token")).rejects.toEqual(new SyncError("turnstile"));
    expect(await phone.repository.sync.meta.get()).toBeUndefined();
  });

  test("sends neither the PRF's output nor the recovery code", async () => {
    const phone = setUp().device(samePrf);
    const { recoveryCode } = await startSync(phone, "token");
    const sent = JSON.stringify(phone.sent);
    expect(sent).not.toContain(toBase64Url(prfOutput("credential-1")));
    expect(sent).not.toContain(toBase64Url(parseRecoveryCode(recoveryCode)!));
    expect(sent).not.toContain(recoveryCode);
  });
});

describe("logging in on another device", () => {
  test("a device whose PRF gives the same output opens the data without the code", async () => {
    const { device } = setUp();
    await startSync(device(samePrf), "token");
    const pc = device(samePrf);
    expect(await signIn(pc)).toEqual({ status: "unlocked" });
    expect((await pc.repository.sync.meta.get())?.accountId).toBeDefined();
  });

  test("a device whose PRF gives another output needs the code, and does not replace the wrap", async () => {
    const { device } = setUp();
    const { recoveryCode } = await startSync(device(samePrf), "token");
    const pc = device(otherPrf);
    const result = await signIn(pc);
    if (result.status !== "needs-recovery-code") throw new Error("unlocked");

    expect(
      await unlockWithRecoveryCode(pc, result.locked, "AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA"),
    ).toBe(false);
    expect(await pc.repository.sync.meta.get()).toBeUndefined();
    expect(await unlockWithRecoveryCode(pc, result.locked, recoveryCode)).toBe(true);
    expect(JSON.stringify(pc.sent)).not.toContain("prfWrap");

    // The phone still opens it with its own output.
    expect(await signIn(device(samePrf))).toEqual({ status: "unlocked" });
  });

  test("a passkey started on a device without PRF gets its wrap from the first device with one", async () => {
    const { device } = setUp();
    const { recoveryCode, prf } = await startSync(device(noPrf), "token");
    expect(prf).toBe(false);
    const phone = device(samePrf);
    const result = await signIn(phone);
    if (result.status !== "needs-recovery-code") throw new Error("unlocked");
    expect(await unlockWithRecoveryCode(phone, result.locked, recoveryCode)).toBe(true);
    expect(await signIn(device(samePrf))).toEqual({ status: "unlocked" });
  });
});

describe("the recovery code without a passkey", () => {
  test("opens the data and makes a new passkey that opens it next time", async () => {
    const { device } = setUp();
    const { recoveryCode } = await startSync(device(samePrf), "token");
    const newPhone = device(samePrf);
    expect(await recoverWithCode(newPhone, "AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA")).toBeUndefined();
    expect(await recoverWithCode(newPhone, recoveryCode)).toEqual({ passkey: true });
    expect((await newPhone.repository.sync.meta.get())?.credentialId).toBe("credential-2");
    expect(await signIn(device(samePrf))).toEqual({ status: "unlocked" });
  });
});

describe("stopping", () => {
  test("a device logged out because another stopped can still stop, and keeps its data", async () => {
    const { device } = setUp();
    const phone = device(samePrf);
    await startSync(phone, "token");
    const pc = device(samePrf);
    await signIn(pc);
    await pc.repository.profile.put({ updatedAt: "2026-10-25T00:00:00.000Z" });
    await stopSync(phone);

    expect(await stopSync(pc)).toEqual({ removed: false });
    expect(await pc.repository.sync.meta.get()).toBeUndefined();
    expect(await pc.repository.profile.get()).toBeDefined();
  });

  test("removes the account, so the passkey no longer logs in, and keeps the data here", async () => {
    const { device } = setUp();
    const phone = device(samePrf);
    await phone.repository.profile.put({ updatedAt: "2026-10-25T00:00:00.000Z" });
    await startSync(phone, "token");
    await stopSync(phone);
    expect(await phone.repository.sync.meta.get()).toBeUndefined();
    expect(await phone.repository.profile.get()).toBeDefined();
    await expect(signIn(device(samePrf))).rejects.toEqual(new SyncError("refused"));
  });
});

describe("reissuing recovery codes", () => {
  test("replaces the code while keeping data keys, passkeys and other sessions", async () => {
    const { device } = setUp();
    const phone = device(samePrf);
    const { recoveryCode: oldCode } = await startSync(phone, "token");
    const pc = device(otherPrf);
    const locked = await signIn(pc);
    if (locked.status !== "needs-recovery-code") throw new Error("unlocked");
    const before = await phone.repository.sync.meta.get();
    const code = await reissueRecoveryCode(phone);
    expect(code).not.toBe(oldCode);
    expect(await recoverWithCode(device(samePrf), oldCode)).toBeUndefined();
    expect(await unlockWithRecoveryCode(pc, locked.locked, oldCode)).toBe(false);
    expect(await unlockWithRecoveryCode(pc, locked.locked, code)).toBe(true);
    expect((await phone.repository.sync.meta.get())?.encryptionKey).toEqual(before?.encryptionKey);
    expect(await signIn(device(samePrf))).toEqual({ status: "unlocked" });
    expect((await pc.server.pull({ since: 0 })).ok).toBe(true);
    expect(await recoverWithCode(device(samePrf), code)).toEqual({ passkey: true });
    expect(JSON.stringify(phone.sent)).not.toContain(code);
  });

  test("refuses a device without local keys", async () => {
    await expect(reissueRecoveryCode(setUp().device(samePrf))).rejects.toEqual(
      new SyncError("signed-out"),
    );
  });
});

test("failed reissue leaves the previous code and local keys usable", async () => {
  const { device } = setUp();
  const phone = device(noPrf);
  const { recoveryCode } = await startSync(phone, "token");
  const before = await phone.repository.sync.meta.get();
  phone.server.reissueRecovery = async () => {
    throw new Error("offline");
  };
  await expect(reissueRecoveryCode(phone)).rejects.toThrow("offline");
  expect(await phone.repository.sync.meta.get()).toEqual(before);
  expect(await recoverWithCode(device(samePrf), recoveryCode)).toEqual({ passkey: true });
});

test("a cookie for another account cannot rotate local data's code", async () => {
  const { device } = setUp();
  const phone = device(samePrf);
  const { recoveryCode } = await startSync(phone, "token");
  const other = device(samePrf);
  await startSync(other, "token");
  await expect(reissueRecoveryCode({ ...phone, server: other.server })).rejects.toEqual(
    new SyncError("signed-out"),
  );
  expect(await recoverWithCode(device(samePrf), recoveryCode)).toEqual({ passkey: true });
});

test("rotation preserves encrypted records and works without PRF", async () => {
  const { device } = setUp();
  const phone = device(noPrf);
  await startSync(phone, "token");
  const meta = await phone.repository.sync.meta.get();
  if (!meta) throw new Error("no keys");
  const { encryptRow, decryptRecord } = await import("./sync-crypto");
  const record = await encryptRow(
    meta,
    {
      kind: "profile",
      id: "profile",
      updatedAt: "2026-10-25T00:00:00.000Z",
      deleted: false,
      value: { updatedAt: "2026-10-25T00:00:00.000Z" },
    },
    1,
  );
  expect(await phone.server.push({ records: [record] })).toEqual({ ok: true });
  const code = await reissueRecoveryCode(phone);
  const pc = device(noPrf);
  await recoverWithCode(pc, code);
  const restored = await pc.repository.sync.meta.get();
  if (!restored) throw new Error("no keys");
  const pulled = await pc.server.pull({ since: 0 });
  if (!pulled.ok) throw new Error("signed out");
  expect(pulled.records).toEqual([expect.objectContaining(record)]);
  expect((await decryptRecord(restored, pulled.records[0]!)).row).toMatchObject({
    value: {
      updatedAt: "2026-10-25T00:00:00.000Z",
    },
  });
});

test("logging in again uses keys already open on a device without PRF", async () => {
  const phone = setUp().device(noPrf);
  await startSync(phone, "token");
  const before = await phone.repository.sync.meta.get();
  expect(await signIn(phone)).toEqual({ status: "unlocked" });
  expect(await phone.repository.sync.meta.get()).toEqual(before);
  expect(await reissueRecoveryCode(phone)).toMatch(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
});

test("a legacy device reissues via its passkey and retains a sealed root", async () => {
  const { device } = setUp();
  const phone = device(samePrf);
  await startSync(phone, "token");
  const meta = await phone.repository.sync.meta.get();
  if (!meta) throw new Error("no keys");
  const { masterWrap: _, ...legacy } = meta;
  await phone.repository.sync.meta.put(legacy);
  const code = await reissueRecoveryCode(phone);
  expect((await phone.repository.sync.meta.get())?.masterWrap).toBeDefined();
  expect(await recoverWithCode(device(samePrf), code)).toEqual({ passkey: true });
});

test("a legacy device without PRF explains why it cannot reissue without changing the old code", async () => {
  const { device } = setUp();
  const phone = device(noPrf);
  const { recoveryCode } = await startSync(phone, "token");
  const meta = await phone.repository.sync.meta.get();
  if (!meta) throw new Error("no keys");
  const { masterWrap: _, ...legacy } = meta;
  await phone.repository.sync.meta.put(legacy);
  await expect(reissueRecoveryCode(phone)).rejects.toEqual(new SyncError("master-unavailable"));
  expect(await phone.repository.sync.meta.get()).toEqual(legacy);
  expect(await recoverWithCode(device(samePrf), recoveryCode)).toEqual({ passkey: true });
});

test("a legacy device refuses a passkey for another account", async () => {
  const { device } = setUp();
  const phone = device(samePrf);
  await startSync(phone, "token");
  const meta = await phone.repository.sync.meta.get();
  if (!meta) throw new Error("no keys");
  const { masterWrap: _, ...legacy } = meta;
  await phone.repository.sync.meta.put(legacy);
  const other = device(samePrf);
  await startSync(other, "token");
  await expect(
    reissueRecoveryCode({
      ...phone,
      server: other.server,
      passkeys: {
        ...phone.passkeys,
        get: async (options) => {
          const asserted = await phone.passkeys.get(options);
          return { ...asserted, response: { ...asserted.response, id: "credential-2" } };
        },
      },
    }),
  ).rejects.toEqual(new SyncError("refused"));
  expect(await phone.repository.sync.meta.get()).toEqual(legacy);
});
