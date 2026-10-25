import { describe, expect, test } from "vitest";
import { createMemoryRepository } from "./memory-repository";
import { toBase64Url, parseRecoveryCode } from "./sync-crypto";
import {
  SyncError,
  recoverWithCode,
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
