import type {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { memoryD1 } from "../server/memory-d1";
import * as auth from "../server/sync-auth";
import * as records from "../server/sync-records";
import type { Asserted, Created, Passkeys, SyncServer } from "./sync-passkey";

// Tests only: the sync's server functions over a D1 in memory, with stand-ins for the WebAuthn
// checks, and passkeys whose PRF each test decides. Each device has a cookie of its own.

const verifyRegistration = (async (options: Parameters<typeof verifyRegistrationResponse>[0]) =>
  options.response.response.clientDataJSON === options.expectedChallenge
    ? {
        verified: true,
        registrationInfo: {
          credential: { id: options.response.id, publicKey: new Uint8Array([1]), counter: 0 },
        },
      }
    : { verified: false }) as unknown as typeof verifyRegistrationResponse;

const verifyAuthentication = (async (
  options: Parameters<typeof verifyAuthenticationResponse>[0],
) =>
  options.response.response.clientDataJSON === options.expectedChallenge
    ? { verified: true, authenticationInfo: { newCounter: 0 } }
    : { verified: false }) as unknown as typeof verifyAuthenticationResponse;

export type TestBackend = {
  /** A device's server functions, with a cookie of its own; `sent` collects what it sent. */
  device(): { server: SyncServer; sent: unknown[] };
};

export function createTestBackend({ turnstile = true }: { turnstile?: boolean } = {}): TestBackend {
  const deps: auth.SyncAuthDeps = {
    db: memoryD1(new URL("../../migrations-sync/", import.meta.url)).db,
    rpID: "localhost",
    origin: "http://localhost",
    verifyRegistration,
    verifyAuthentication,
  };
  return {
    device() {
      let cookie: string | undefined;
      const sent: unknown[] = [];
      const record = <T>(data: T) => {
        sent.push(JSON.parse(JSON.stringify(data ?? null)));
        return data;
      };
      const account = () => auth.sessionAccount(deps, cookie);
      const signedOut = { ok: false, reason: "signed-out" } as const;
      const server: SyncServer = {
        startOptions: async (data) =>
          auth.registrationOptions(deps, {
            turnstileToken: record(data).turnstileToken,
            verifyToken: async () =>
              turnstile
                ? { ok: true }
                : { ok: false, error: { reason: "rejected", errorCodes: [] } },
          }),
        addPasskeyOptions: async () => {
          const accountId = await account();
          return (accountId && (await auth.registrationOptions(deps, { accountId }))) || signedOut;
        },
        register: async (data) => {
          const session = await auth.register(deps, record(data));
          if (!session) return undefined;
          cookie = session.sessionToken;
          return { accountId: session.accountId, credentialId: session.credentialId };
        },
        loginOptions: async () => auth.authenticationOptions(deps),
        login: async (data) => {
          const login = await auth.authenticate(deps, record(data));
          if (!login) return undefined;
          cookie = login.sessionToken;
          const { sessionToken: _, ...rest } = login;
          return rest;
        },
        recoveryLogin: async (data) => {
          const login = await auth.loginWithRecovery(deps, record(data).verifier);
          if (!login) return undefined;
          cookie = login.sessionToken;
          return { accountId: login.accountId, recoveryWrap: login.recoveryWrap };
        },
        setPrfWrap: async (data) => {
          const accountId = await account();
          record(data);
          return accountId
            ? auth.setPrfWrap(deps, accountId, data.credentialId, data.prfWrap)
            : false;
        },
        push: async (data) => {
          const accountId = await account();
          record(data);
          return accountId ? records.push(deps, accountId, data.records) : signedOut;
        },
        pull: async (data) => {
          const accountId = await account();
          return accountId
            ? { ok: true, ...(await records.pull(deps, accountId, data.since)) }
            : signedOut;
        },
        stop: async () => {
          const accountId = await account();
          if (!accountId) return signedOut;
          await records.deleteAccount(deps, accountId);
          cookie = undefined;
          return { ok: true };
        },
      };
      return { server, sent };
    },
  };
}

/**
 * The passkeys every device shares, as a password manager syncs them. `prf` gives each device's
 * PRF output for a passkey: `undefined` for a device without PRF.
 */
export function createTestPasskeys() {
  const made: string[] = [];
  const device = (
    prf: (credentialId: string) => Uint8Array | undefined,
    { prfOnCreate = false }: { prfOnCreate?: boolean } = {},
  ): Passkeys => ({
    create: async (options): Promise<Created> => {
      const id = `credential-${made.length + 1}`;
      made.push(id);
      return {
        response: {
          id,
          rawId: id,
          type: "public-key",
          response: { clientDataJSON: options.challenge, attestationObject: "" },
          clientExtensionResults: {},
        } as unknown as Created["response"],
        prfEnabled: prf(id) !== undefined,
        prf: prfOnCreate ? prf(id) : undefined,
      };
    },
    get: async (options): Promise<Asserted> => {
      const id = options.allowCredentials?.[0]?.id ?? made.at(-1);
      if (!id) throw Object.assign(new Error("no passkey"), { name: "NotAllowedError" });
      return {
        response: {
          id,
          rawId: id,
          type: "public-key",
          response: { clientDataJSON: options.challenge, authenticatorData: "", signature: "" },
          clientExtensionResults: {},
        } as unknown as Asserted["response"],
        prf: prf(id),
      };
    },
  });
  return { device };
}

/** A fixed PRF output per passkey, and another one for a device whose output differs. */
export const prfOutput = (credentialId: string, salt = "") =>
  new TextEncoder().encode(`${salt}prf-of-${credentialId}`.padEnd(32, "."));
