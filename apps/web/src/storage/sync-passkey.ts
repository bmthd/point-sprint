import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type { PullResult, PushResult } from "../server/sync/sync-records";
import type { Repository } from "./repository";
import {
  PRF_SALT,
  type RemoteRecord,
  deriveKeys,
  generateMasterSecret,
  generateRecoveryCode,
  parseRecoveryCode,
  openMaster,
  sealMaster,
  recoveryVerifier,
  toBase64Url,
  unwrapSecret,
  wrapSecret,
} from "./sync-crypto";

// Starting to sync, logging in on another device, and opening the data's secret there: with the
// passkey's PRF where it gives the output it wrapped the secret with, else with the recovery code.

type CreationOptions = Omit<PublicKeyCredentialCreationOptionsJSON, "extensions">;
type RequestOptions = Omit<PublicKeyCredentialRequestOptionsJSON, "extensions">;

/** The passkey's response, without the PRF's output, which never leaves the device. */
export type Created = {
  response: RegistrationResponseJSON;
  /** `false` when the passkey said it has no PRF, `undefined` when it did not say. */
  prfEnabled: boolean | undefined;
  prf: Uint8Array | undefined;
};
export type Asserted = { response: AuthenticationResponseJSON; prf: Uint8Array | undefined };

export type Passkeys = {
  create(options: CreationOptions): Promise<Created>;
  /** Asks for any of the site's passkeys, or for one of `allowCredentials`. */
  get(options: RequestOptions): Promise<Asserted>;
};

/** The PRF's output and the extension results without it, which are what the server gets. */
function splitPrf(results: object) {
  const { prf, ...rest } = results as {
    prf?: { enabled?: boolean; results?: { first?: BufferSource } };
  };
  const first = prf?.results?.first;
  return {
    rest,
    enabled: prf?.enabled,
    output:
      first === undefined
        ? undefined
        : new Uint8Array(ArrayBuffer.isView(first) ? first.buffer : first).slice(),
  };
}

/** The browser's passkeys, asked for the PRF's output of `PRF_SALT` every time. */
export const browserPasskeys: Passkeys = {
  create: async (options) => {
    const response = await startRegistration({
      optionsJSON: {
        ...options,
        extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
      },
    });
    const { rest, enabled, output } = splitPrf(response.clientExtensionResults);
    return {
      response: { ...response, clientExtensionResults: rest },
      prfEnabled: enabled ?? (output ? true : undefined),
      prf: output,
    };
  },
  get: async (options) => {
    const response = await startAuthentication({
      optionsJSON: {
        ...options,
        extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
      },
    });
    const { rest, output } = splitPrf(response.clientExtensionResults);
    return { response: { ...response, clientExtensionResults: rest }, prf: output };
  },
};

type Maybe<T> = Promise<T | undefined>;
type SignedOut = { ok: false; reason: "signed-out" };

/** The server functions the flows call (src/server/sync/sync.functions.ts). */
export type SyncServer = {
  startOptions(data: {
    turnstileToken: string;
  }): Maybe<{ challengeId: string; options: CreationOptions }>;
  addPasskeyOptions(): Promise<{ challengeId: string; options: CreationOptions } | SignedOut>;
  register(data: {
    challengeId: string;
    response: RegistrationResponseJSON;
    recovery?: { verifier: string; wrap: string };
  }): Maybe<{ accountId: string; credentialId: string }>;
  loginOptions(): Promise<{ challengeId: string; options: RequestOptions }>;
  login(data: { challengeId: string; response: AuthenticationResponseJSON }): Maybe<{
    accountId: string;
    credentialId: string;
    prfWrap: string | null;
    recoveryWrap: string;
  }>;
  recoveryLogin(data: { verifier: string }): Maybe<{ accountId: string; recoveryWrap: string }>;
  reissueRecovery(data: { accountId: string; verifier: string; wrap: string }): Promise<boolean>;
  setPrfWrap(data: { credentialId: string; prfWrap: string }): Promise<boolean>;
  stop(): Promise<{ ok: true } | SignedOut>;
  push(data: { records: RemoteRecord[] }): Promise<PushResult | SignedOut>;
  pull(data: { since: number }): Promise<({ ok: true } & PullResult) | SignedOut>;
};

export type PasskeyDeps = { passkeys: Passkeys; server: SyncServer; repository: Repository };

export type SyncErrorReason =
  /** An older device did not keep the root and its passkey cannot open it. */
  | "master-unavailable"
  /** Turnstile did not let the request through. */
  | "turnstile"
  /** The user closed the passkey's dialog, or the device has no passkey for the site. */
  | "cancelled"
  /** The server refused the passkey or the code. */
  | "refused"
  /** The session ended; log in again. */
  | "signed-out";

export class SyncError extends Error {
  constructor(readonly reason: SyncErrorReason) {
    super(`sync failed: ${reason}`);
    this.name = "SyncError";
  }
}

const isSignedOut = (value: unknown): value is SignedOut =>
  typeof value === "object" && value !== null && "reason" in value && value.reason === "signed-out";

const passkey = async <T>(ceremony: Promise<T>): Promise<T> => {
  try {
    return await ceremony;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotAllowedError" || error.name === "AbortError")
    ) {
      throw new SyncError("cancelled");
    }
    throw error;
  }
};

/** Keeps the keys on this device and marks everything to send. */
async function unlock(
  repository: Repository,
  master: Uint8Array,
  accountId: string,
  credentialId: string | undefined,
) {
  const keys = await deriveKeys(master);
  await repository.sync.meta.put({
    accountId,
    masterWrap: await sealMaster(keys.encryptionKey, master),
    cursor: 0,
    ...(credentialId ? { credentialId } : {}),
    ...keys,
  });
  await repository.sync.markAllPending();
}

/** The PRF's output of a passkey just made: from making it, or else from using it once. */
async function prfOf(passkeys: Passkeys, created: Created, credentialId: string) {
  if (created.prf) return created.prf;
  if (created.prfEnabled === false) return undefined;
  const asserted = await passkey(
    passkeys.get({
      challenge: toBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
    }),
  ).catch((error: unknown) => {
    // Without it, the other devices open the secret with the recovery code.
    if (error instanceof SyncError) return undefined;
    throw error;
  });
  return asserted?.prf;
}

/** Wraps the secret with the passkey's PRF output, if it gave one. */
async function keepPrfWrap(
  { passkeys, server }: PasskeyDeps,
  master: Uint8Array,
  created: Created,
  credentialId: string,
): Promise<boolean> {
  const prf = await prfOf(passkeys, created, credentialId);
  if (!prf) return false;
  return server.setPrfWrap({ credentialId, prfWrap: await wrapSecret(master, prf, "prf") });
}

export type Started = {
  /** To show once: the server does not keep it. */
  recoveryCode: string;
  /** Whether the passkey's PRF wraps the secret, so that other devices open it with the passkey. */
  prf: boolean;
};

/** Makes a passkey and a new account, and the secret this device's data is sealed with. */
export async function startSync(deps: PasskeyDeps, turnstileToken: string): Promise<Started> {
  const { passkeys, server, repository } = deps;
  const options = await server.startOptions({ turnstileToken });
  if (!options) throw new SyncError("turnstile");

  const master = generateMasterSecret();
  const recoveryCode = generateRecoveryCode();
  const codeBytes = parseRecoveryCode(recoveryCode);
  if (!codeBytes) throw new Error("the recovery code does not read back");
  const recovery = {
    verifier: await recoveryVerifier(codeBytes),
    wrap: await wrapSecret(master, codeBytes, "recovery"),
  };

  const created = await passkey(passkeys.create(options.options));
  const session = await server.register({
    challengeId: options.challengeId,
    response: created.response,
    recovery,
  });
  if (!session) throw new SyncError("refused");
  const prf = await keepPrfWrap(deps, master, created, session.credentialId);
  await unlock(repository, master, session.accountId, session.credentialId);
  return { recoveryCode, prf };
}

/** What logging in left to open the secret with the recovery code. */
export type Locked = {
  accountId: string;
  credentialId: string;
  recoveryWrap: string;
  /** The PRF's output, to wrap the secret with when the passkey has no wrap yet. */
  prf: Uint8Array | undefined;
  hasPrfWrap: boolean;
};

/**
 * Logs in with a passkey and opens the secret with its PRF output. When the device gives no
 * output, or another one than the secret was wrapped with, the recovery code is needed.
 */
export async function signIn(
  deps: PasskeyDeps,
): Promise<{ status: "unlocked" } | { status: "needs-recovery-code"; locked: Locked }> {
  const { passkeys, server, repository } = deps;
  const { challengeId, options } = await server.loginOptions();
  const asserted = await passkey(passkeys.get(options));
  const login = await server.login({ challengeId, response: asserted.response });
  if (!login) throw new SyncError("refused");

  const local = await repository.sync.meta.get();
  if (local?.accountId === login.accountId && local.masterWrap) {
    await openMaster(local.encryptionKey, local.masterWrap);
    return { status: "unlocked" };
  }

  const master =
    login.prfWrap && asserted.prf
      ? await unwrapSecret(login.prfWrap, asserted.prf, "prf")
      : undefined;
  if (master) {
    await unlock(repository, master, login.accountId, login.credentialId);
    return { status: "unlocked" };
  }
  return {
    status: "needs-recovery-code",
    locked: {
      accountId: login.accountId,
      credentialId: login.credentialId,
      recoveryWrap: login.recoveryWrap,
      prf: asserted.prf,
      hasPrfWrap: login.prfWrap !== null,
    },
  };
}

/**
 * Opens the secret with the recovery code after logging in. Resolves to `false` for a wrong code.
 * A passkey with no wrap gets one from its PRF output; one that has a wrap keeps it, since this
 * device's output differs from the one it was made with.
 */
export async function unlockWithRecoveryCode(
  deps: PasskeyDeps,
  locked: Locked,
  code: string,
): Promise<boolean> {
  const bytes = parseRecoveryCode(code);
  const current =
    bytes && (await deps.server.recoveryLogin({ verifier: await recoveryVerifier(bytes) }));
  if (!current || current.accountId !== locked.accountId) return false;
  const master = bytes && (await unwrapSecret(current.recoveryWrap, bytes, "recovery"));
  if (!master) return false;
  if (locked.prf && !locked.hasPrfWrap) {
    await deps.server.setPrfWrap({
      credentialId: locked.credentialId,
      prfWrap: await wrapSecret(master, locked.prf, "prf"),
    });
  }
  await unlock(deps.repository, master, locked.accountId, locked.credentialId);
  return true;
}

/**
 * For a user whose passkeys are gone: logs in with the recovery code, opens the secret, then makes
 * a new passkey. Resolves to `undefined` for a wrong code, else to whether the passkey was made.
 */
export async function recoverWithCode(
  deps: PasskeyDeps,
  code: string,
): Promise<{ passkey: boolean } | undefined> {
  const { passkeys, server, repository } = deps;
  const bytes = parseRecoveryCode(code);
  if (!bytes) return undefined;
  const login = await server.recoveryLogin({ verifier: await recoveryVerifier(bytes) });
  const master = login && (await unwrapSecret(login.recoveryWrap, bytes, "recovery"));
  if (!login || !master) return undefined;
  await unlock(repository, master, login.accountId, undefined);

  try {
    const options = await server.addPasskeyOptions();
    if (isSignedOut(options)) return { passkey: false };
    const created = await passkey(passkeys.create(options.options));
    const session = await server.register({
      challengeId: options.challengeId,
      response: created.response,
    });
    if (!session) return { passkey: false };
    await keepPrfWrap(deps, master, created, session.credentialId);
    const meta = await repository.sync.meta.get();
    if (meta) await repository.sync.meta.put({ ...meta, credentialId: session.credentialId });
    return { passkey: true };
  } catch (error) {
    if (error instanceof SyncError) return { passkey: false };
    throw error;
  }
}

/**
 * Removes the account and its data from the server and stops syncing here; this device's data
 * stays. Asks the password manager to drop the passkey, where the browser can.
 *
 * A device that is logged out, as when another device stopped the sync and removed the account,
 * still stops here: resolves to `{ removed: false }`, the server's rows left as they are.
 */
export async function stopSync({ server, repository }: PasskeyDeps): Promise<{ removed: boolean }> {
  const result = await server.stop();
  const meta = await repository.sync.meta.get();
  await repository.sync.meta.put(undefined);
  if (isSignedOut(result)) return { removed: false };
  const credentials = globalThis.PublicKeyCredential as
    | {
        signalUnknownCredential?: (options: {
          rpId: string;
          credentialId: string;
        }) => Promise<void>;
      }
    | undefined;
  if (meta?.credentialId && credentials?.signalUnknownCredential) {
    // Called on `PublicKeyCredential` itself: detached, it throws. Only a hint to the password
    // manager, so a failure is left alone.
    try {
      await credentials.signalUnknownCredential({
        rpId: location.hostname,
        credentialId: meta.credentialId,
      });
    } catch {}
  }
  return { removed: true };
}

/** Rewraps the same root, leaving records, passkeys and other devices' keys intact. */
export async function reissueRecoveryCode(deps: PasskeyDeps): Promise<string> {
  const meta = await deps.repository.sync.meta.get();
  if (!meta) throw new SyncError("signed-out");
  let master: Uint8Array | undefined;
  if (meta.masterWrap) {
    master = await openMaster(meta.encryptionKey, meta.masterWrap);
  } else {
    const { challengeId, options } = await deps.server.loginOptions();
    const asserted = await passkey(deps.passkeys.get(options));
    const login = await deps.server.login({ challengeId, response: asserted.response });
    if (!login || login.accountId !== meta.accountId) throw new SyncError("refused");
    if (login.prfWrap && asserted.prf)
      master = await unwrapSecret(login.prfWrap, asserted.prf, "prf");
    if (!master) throw new SyncError("master-unavailable");
    // Check that this really is the root for the data already open here.
    const wrapped = await sealMaster((await deriveKeys(master)).encryptionKey, master);
    await openMaster(meta.encryptionKey, wrapped);
    await deps.repository.sync.meta.put({ ...meta, masterWrap: wrapped });
  }
  const code = generateRecoveryCode();
  const bytes = parseRecoveryCode(code);
  if (!bytes) throw new Error("the recovery code does not read back");
  const updated = await deps.server.reissueRecovery({
    accountId: meta.accountId,
    verifier: await recoveryVerifier(bytes),
    wrap: await wrapSecret(master, bytes, "recovery"),
  });
  if (!updated) throw new SyncError("signed-out");
  return code;
}
