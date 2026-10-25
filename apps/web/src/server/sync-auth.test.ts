import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { describe, expect, test } from "vitest";
import { memoryD1 } from "./memory-d1";
import {
  type SyncAuthDeps,
  authenticate,
  authenticationOptions,
  loginWithRecovery,
  register,
  registrationOptions,
  sessionAccount,
  setPrfWrap,
} from "./sync-auth";

// The WebAuthn checks are stood in for: a response passes when it carries the challenge it was
// given in `clientDataJSON`. The real checks run in the E2E tests, against a virtual authenticator.

const verifyRegistration = (async (options: Parameters<typeof verifyRegistrationResponse>[0]) =>
  options.response.response.clientDataJSON === options.expectedChallenge
    ? {
        verified: true,
        registrationInfo: {
          credential: {
            id: options.response.id,
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ["internal"],
          },
        },
      }
    : { verified: false }) as unknown as typeof verifyRegistrationResponse;

const verifyAuthentication = (async (
  options: Parameters<typeof verifyAuthenticationResponse>[0],
) =>
  options.response.response.clientDataJSON === options.expectedChallenge
    ? { verified: true, authenticationInfo: { newCounter: 1 } }
    : { verified: false }) as unknown as typeof verifyAuthenticationResponse;

let clock = new Date("2026-10-25T00:00:00.000Z");
const deps = (): SyncAuthDeps => ({
  db: memoryD1(new URL("../../migrations-sync/", import.meta.url)).db,
  rpID: "point-sprint.bmth.dev",
  origin: "https://point-sprint.bmth.dev",
  now: () => clock,
  verifyRegistration,
  verifyAuthentication,
});

const passes = async () => ({ ok: true }) as const;
const recovery = { verifier: "verifier", wrap: "recovery-wrap" };

const registration = (id: string, challenge: string) =>
  ({ id, response: { clientDataJSON: challenge } }) as unknown as RegistrationResponseJSON;
const assertion = (id: string, challenge: string) =>
  ({ id, response: { clientDataJSON: challenge } }) as unknown as AuthenticationResponseJSON;

async function start(d: SyncAuthDeps, credentialId = "credential-1") {
  const options = await registrationOptions(d, { turnstileToken: "t", verifyToken: passes });
  if (!options) throw new Error("no options");
  const session = await register(d, {
    challengeId: options.challengeId,
    response: registration(credentialId, options.options.challenge),
    recovery,
  });
  if (!session) throw new Error("not registered");
  return session;
}

async function logIn(d: SyncAuthDeps, credentialId = "credential-1") {
  const { challengeId, options } = await authenticationOptions(d);
  return authenticate(d, { challengeId, response: assertion(credentialId, options.challenge) });
}

describe("starting to sync", () => {
  test("Turnstile has to let the request through", async () => {
    const d = deps();
    const refused = await registrationOptions(d, {
      turnstileToken: "t",
      verifyToken: async () => ({ ok: false, error: { reason: "rejected", errorCodes: [] } }),
    });
    expect(refused).toBeUndefined();
  });

  test("the passkey is named after the site, not the user", async () => {
    const options = await registrationOptions(deps(), { turnstileToken: "t", verifyToken: passes });
    expect(options?.options.user.name).toBe("ポイントスプリント（2026-10-25）");
  });

  test("a new passkey logs in to its new account", async () => {
    const d = deps();
    const session = await start(d);
    expect(await sessionAccount(d, session.sessionToken)).toBe(session.accountId);
    expect(await logIn(d)).toMatchObject({
      accountId: session.accountId,
      prfWrap: null,
      recoveryWrap: "recovery-wrap",
    });
  });

  test("a challenge is used once, and not after 5 minutes", async () => {
    const d = deps();
    const options = await registrationOptions(d, { turnstileToken: "t", verifyToken: passes });
    const request = {
      challengeId: options!.challengeId,
      response: registration("c", options!.options.challenge),
      recovery,
    };
    expect(await register(d, request)).toBeDefined();
    expect(await register(d, request)).toBeUndefined();

    const later = await authenticationOptions(d);
    clock = new Date(clock.getTime() + 5 * 60 * 1000 + 1);
    expect(
      await authenticate(d, {
        challengeId: later.challengeId,
        response: assertion("c", later.options.challenge),
      }),
    ).toBeUndefined();
    clock = new Date("2026-10-25T00:00:00.000Z");
  });

  test("a response to another challenge is refused", async () => {
    const d = deps();
    await start(d);
    const { challengeId } = await authenticationOptions(d);
    expect(
      await authenticate(d, { challengeId, response: assertion("credential-1", "other") }),
    ).toBeUndefined();
  });
});

describe("the recovery code", () => {
  test("logs in to the account whose verifier it makes, and adds a passkey to it", async () => {
    const d = deps();
    const session = await start(d);
    expect(await loginWithRecovery(d, "wrong")).toBeUndefined();
    const login = await loginWithRecovery(d, "verifier");
    expect(login).toMatchObject({ accountId: session.accountId, recoveryWrap: "recovery-wrap" });

    const options = await registrationOptions(d, { accountId: session.accountId });
    const added = await register(d, {
      challengeId: options!.challengeId,
      response: registration("credential-2", options!.options.challenge),
    });
    expect(added?.accountId).toBe(session.accountId);
    expect((await logIn(d, "credential-2"))?.accountId).toBe(session.accountId);
  });
});

describe("the PRF's wrap", () => {
  test("is kept once and never replaced", async () => {
    const d = deps();
    const session = await start(d);
    expect(await setPrfWrap(d, session.accountId, session.credentialId, "first")).toBe(true);
    expect(await setPrfWrap(d, session.accountId, session.credentialId, "second")).toBe(false);
    expect((await logIn(d))?.prfWrap).toBe("first");
  });

  test("is not set on another account's passkey", async () => {
    const d = deps();
    const session = await start(d);
    expect(await setPrfWrap(d, "someone-else", session.credentialId, "wrap")).toBe(false);
  });
});

describe("sessions", () => {
  test("an unknown or expired token is logged out", async () => {
    const d = deps();
    const session = await start(d);
    expect(await sessionAccount(d, "unknown")).toBeUndefined();
    clock = new Date(clock.getTime() + 401 * 24 * 60 * 60 * 1000);
    expect(await sessionAccount(d, session.sessionToken)).toBeUndefined();
    clock = new Date("2026-10-25T00:00:00.000Z");
  });
});
